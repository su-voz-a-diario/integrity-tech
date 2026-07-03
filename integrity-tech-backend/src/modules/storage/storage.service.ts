import { createHash, randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuditService } from '../audit/services/audit.service';
import { ArchiveService } from '../data-governance/services/archive.service';
import { OrganizationContextService, PERMISSIONS, SessionUser } from '../iam';
import {
  ALLOWED_PRIVATE_FILE_MIME_TYPES,
  assertStorageConfig,
  getMaxPrivateFileBytes,
  getSignedUrlTtlSeconds,
  getStorageProviderName,
} from './storage.config';
import { LocalPrivateStorageProvider } from './providers/local-private-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { StorageProvider } from './storage-provider.interface';

type StorePrivateFileInput = {
  organizationId: string;
  ownerUserId?: string | null;
  attemptId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  body: Buffer;
  mimeType: string;
  classification: 'CONFIDENTIAL' | 'HIGHLY_SENSITIVE';
};

@Injectable()
export class StorageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly archive: ArchiveService,
    private readonly organizationContext: OrganizationContextService,
    private readonly localProvider: LocalPrivateStorageProvider,
    private readonly s3Provider: S3StorageProvider,
  ) {
    assertStorageConfig(process.env);
  }

  async storePrivateFile(input: StorePrivateFileInput) {
    this.validateFile(input.body, input.mimeType, input.classification);
    const checksumSha256 = createHash('sha256').update(input.body).digest('hex');
    const provider = this.resolveProvider();
    const objectKey = this.createObjectKey(input.organizationId, input.resourceType, input.mimeType);
    const stored = await provider.putObject({
      objectKey,
      body: input.body,
      mimeType: input.mimeType,
      classification: input.classification,
    });

    const file = await (this.prisma as any).privateFile.create({
      data: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId || null,
        attemptId: input.attemptId || null,
        resourceType: input.resourceType,
        resourceId: input.resourceId || null,
        storageProvider: stored.storageProvider,
        bucket: stored.bucket || null,
        objectKey: stored.objectKey,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.body.length),
        checksumSha256,
        classification: input.classification,
      },
    });

    await this.archive.registerActiveResource({
      organizationId: input.organizationId,
      resourceType: input.resourceType === 'SNAPSHOT' ? 'SNAPSHOT' : 'PROCTORING_EVENT',
      resourceId: file.id,
      metadata: {
        attemptId: input.attemptId || null,
        classification: input.classification,
        storageProvider: stored.storageProvider,
      },
    });

    return this.sanitizeFile(file);
  }

  async storeSnapshot(input: {
    organizationId: string;
    ownerUserId: string;
    attemptId: string;
    dataUrl: string;
  }) {
    const parsed = this.parseDataUrl(input.dataUrl);
    return this.storePrivateFile({
      organizationId: input.organizationId,
      ownerUserId: input.ownerUserId,
      attemptId: input.attemptId,
      resourceType: 'SNAPSHOT',
      resourceId: input.attemptId,
      body: parsed.body,
      mimeType: parsed.mimeType,
      classification: 'HIGHLY_SENSITIVE',
    });
  }

  async getAuthorizedFile(user: SessionUser, fileId: string) {
    const file = await this.findActiveFile(fileId, user.organizationId);
    await this.assertCanAccessFile(user, file);
    await this.audit.record({
      organizationId: file.organizationId,
      actorUserId: user.userId,
      actorType: user.roles?.includes('candidate') ? 'CANDIDATE' : 'STAFF',
      action: 'file.private.accessed',
      resourceType: 'PrivateFile',
      resourceId: file.id,
      metadata: {
        resourceType: file.resourceType,
        attemptId: file.attemptId,
        classification: file.classification,
      },
    });
    return file;
  }

  async getAuthorizedStream(user: SessionUser, fileId: string) {
    const file = await this.getAuthorizedFile(user, fileId);
    const provider = this.resolveProvider(file.storageProvider);
    return {
      file: this.sanitizeFile(file),
      stream: await provider.getObjectStream(file.objectKey),
    };
  }

  async getAuthorizedDownloadUrl(user: SessionUser, fileId: string) {
    const file = await this.getAuthorizedFile(user, fileId);
    const provider = this.resolveProvider(file.storageProvider);
    const ttlSeconds = getSignedUrlTtlSeconds();
    const signedUrl = await provider.getSignedUrl(file.objectKey, ttlSeconds);
    return {
      file: this.sanitizeFile(file),
      expiresInSeconds: ttlSeconds,
      url: signedUrl || `/api/files/${file.id}`,
      mode: signedUrl ? 'signed-url' : 'authenticated-stream',
    };
  }

  async healthCheck() {
    return this.resolveProvider().healthCheck();
  }

  private async findActiveFile(fileId: string, organizationId: string) {
    const file = await (this.prisma as any).privateFile.findFirst({
      where: { id: fileId, organizationId, deletedAt: null },
      include: { attempt: { select: { id: true, userId: true, organizationId: true } } },
    });
    if (!file) throw new NotFoundException('Archivo no disponible.');
    return file;
  }

  private async assertCanAccessFile(user: SessionUser, file: any) {
    if (user.organizationId !== file.organizationId) {
      throw new NotFoundException('Archivo no disponible.');
    }

    if (user.roles?.includes('candidate')) {
      const ownsFile = file.ownerUserId === user.userId;
      const ownsAttempt = file.attempt?.userId === user.userId;
      if (!ownsFile || !ownsAttempt) {
        throw new ForbiddenException('No tienes permisos para acceder a este archivo.');
      }
      return;
    }

    await this.organizationContext.requirePermissions(user, [
      PERMISSIONS.ATTEMPTS_READ,
    ]).catch(async () => {
      await this.organizationContext.requirePermissions(user, [PERMISSIONS.REPORTS_READ]);
    }).catch(async () => {
      await this.organizationContext.requirePermissions(user, [PERMISSIONS.ADMIN_MANAGE]);
    });
  }

  private validateFile(body: Buffer, mimeType: string, classification: string) {
    if (!['CONFIDENTIAL', 'HIGHLY_SENSITIVE'].includes(classification)) {
      throw new BadRequestException('La clasificación del archivo es obligatoria y debe ser sensible.');
    }
    if (!ALLOWED_PRIVATE_FILE_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Tipo MIME no permitido para evidencia privada.');
    }
    const maxBytes = getMaxPrivateFileBytes();
    if (body.length <= 0 || body.length > maxBytes) {
      throw new BadRequestException('El archivo excede el tamaño permitido.');
    }
  }

  private parseDataUrl(dataUrl: string) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new BadRequestException('El formato de la imagen Base64 no es válido.');
    return {
      mimeType: match[1],
      body: Buffer.from(match[2], 'base64'),
    };
  }

  private createObjectKey(organizationId: string, resourceType: string, mimeType: string) {
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const now = new Date();
    return [
      organizationId,
      resourceType.toLowerCase(),
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      `${randomUUID()}.${extension}`,
    ].join('/');
  }

  private resolveProvider(name = getStorageProviderName()): StorageProvider {
    if (name === 's3') return this.s3Provider;
    return this.localProvider;
  }

  private sanitizeFile(file: any) {
    return {
      id: file.id,
      organizationId: file.organizationId,
      ownerUserId: file.ownerUserId,
      attemptId: file.attemptId,
      resourceType: file.resourceType,
      resourceId: file.resourceId,
      storageProvider: file.storageProvider,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes?.toString?.() || String(file.sizeBytes),
      checksumSha256: file.checksumSha256,
      classification: file.classification,
      createdAt: file.createdAt,
      deletedAt: file.deletedAt,
    };
  }
}
