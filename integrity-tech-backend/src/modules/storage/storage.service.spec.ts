import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LocalPrivateStorageProvider } from './providers/local-private-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { GcsStorageProvider } from './providers/gcs-storage.provider';
import { StorageService } from './storage.service';

describe('StorageService private evidence storage', () => {
  const originalEnv = { ...process.env };
  let tempDir: string;
  let prisma: any;
  let audit: any;
  let archive: any;
  let organizationContext: any;
  let service: StorageService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'integrity-private-storage-'));
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      STORAGE_PROVIDER: 'local-private',
      STORAGE_LOCAL_PRIVATE_PATH: tempDir,
      STORAGE_SIGNED_URL_TTL_SECONDS: '300',
      STORAGE_MAX_FILE_BYTES: '2097152',
    };
    prisma = {
      privateFile: {
        create: jest.fn(async ({ data }) => ({
          id: '00000000-0000-7000-8000-000000000f01',
          createdAt: new Date(),
          deletedAt: null,
          ...data,
        })),
        findFirst: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    archive = { registerActiveResource: jest.fn().mockResolvedValue({ id: 'life-1' }) };
    organizationContext = { requirePermissions: jest.fn().mockResolvedValue({ permissions: ['attempts.read'] }) };
    service = new StorageService(
      prisma,
      audit,
      archive,
      organizationContext,
      new LocalPrivateStorageProvider(),
      {} as S3StorageProvider,
      {} as GcsStorageProvider,
    );
  });

  afterEach(async () => {
    process.env = originalEnv;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('stores local private files outside public and computes checksum', async () => {
    const file = await service.storePrivateFile({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      attemptId: 'attempt-1',
      resourceType: 'SNAPSHOT',
      resourceId: 'attempt-1',
      body: Buffer.from('private-image'),
      mimeType: 'image/jpeg',
      classification: 'HIGHLY_SENSITIVE',
    });

    const createData = prisma.privateFile.create.mock.calls[0][0].data;
    expect(createData.objectKey).not.toContain('snapshot.jpg');
    expect(createData.objectKey).not.toContain('/public');
    expect(createData.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(file.checksumSha256).toBe(createData.checksumSha256);
    await expect(readFile(join(tempDir, createData.objectKey))).resolves.toEqual(Buffer.from('private-image'));
  });

  it('registers lifecycle when snapshot is stored', async () => {
    await service.storeSnapshot({
      organizationId: 'org-1',
      ownerUserId: 'candidate-1',
      attemptId: 'attempt-1',
      dataUrl: `data:image/png;base64,${Buffer.from('png-data').toString('base64')}`,
    });

    expect(prisma.privateFile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resourceType: 'SNAPSHOT',
          classification: 'HIGHLY_SENSITIVE',
          mimeType: 'image/png',
        }),
      }),
    );
    expect(archive.registerActiveResource).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'SNAPSHOT',
        resourceId: '00000000-0000-7000-8000-000000000f01',
      }),
    );
  });

  it('does not deliver files cross-tenant', async () => {
    prisma.privateFile.findFirst.mockResolvedValue(null);

    await expect(
      service.getAuthorizedFile(
        { userId: 'user-1', organizationId: 'org-a', email: 'a@test', roles: ['candidate'] },
        '00000000-0000-7000-8000-000000000f01',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks candidate from another attempt owner', async () => {
    prisma.privateFile.findFirst.mockResolvedValue({
      id: 'file-1',
      organizationId: 'org-1',
      ownerUserId: 'candidate-2',
      attemptId: 'attempt-2',
      attempt: { id: 'attempt-2', userId: 'candidate-2', organizationId: 'org-1' },
      deletedAt: null,
    });

    await expect(
      service.getAuthorizedFile(
        { userId: 'candidate-1', organizationId: 'org-1', email: 'a@test', roles: ['candidate'] },
        '00000000-0000-7000-8000-000000000f01',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks staff without file read permissions', async () => {
    organizationContext.requirePermissions.mockRejectedValue(new ForbiddenException());
    prisma.privateFile.findFirst.mockResolvedValue({
      id: 'file-1',
      organizationId: 'org-1',
      ownerUserId: 'candidate-1',
      attemptId: 'attempt-1',
      attempt: { id: 'attempt-1', userId: 'candidate-1', organizationId: 'org-1' },
      deletedAt: null,
    });

    await expect(
      service.getAuthorizedFile(
        { userId: 'staff-1', organizationId: 'org-1', email: 's@test', roles: ['recruiter'] },
        '00000000-0000-7000-8000-000000000f01',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
