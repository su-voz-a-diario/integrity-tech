import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../audit/services/audit.service';
import { SessionUser } from '../../iam';
import {
  CreateVersionFromPublishedDto,
  EditorialAction,
  EditorialActionDto,
  UpdateDraftVersionDto,
} from '../dto/editorial-console.dto';
import { PsychometricVersioningService } from './psychometric-versioning.service';

@Injectable()
export class EditorialConsoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versioning: PsychometricVersioningService,
    private readonly audit: AuditService,
  ) {}

  listAssessments(user: SessionUser) {
    return (this.prisma as any).assessment.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        versions: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, version: true, status: true, publishedAt: true, retiredAt: true },
        },
      },
    });
  }

  async getAssessment(user: SessionUser, assessmentId: string) {
    const assessment = await (this.prisma as any).assessment.findFirst({
      where: { id: assessmentId, organizationId: user.organizationId },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            itemLinks: {
              orderBy: { sortOrder: 'asc' },
              include: {
                itemVersion: {
                  select: {
                    id: true,
                    version: true,
                    status: true,
                    language: true,
                    publishedAt: true,
                    retiredAt: true,
                    item: {
                      select: { id: true, itemCode: true, status: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!assessment) throw new NotFoundException('Prueba no disponible.');
    return assessment;
  }

  listAssessmentVersions(user: SessionUser, assessmentId: string) {
    return (this.prisma as any).assessmentVersion.findMany({
      where: { assessmentId, organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        assessmentId: true,
        version: true,
        status: true,
        title: true,
        description: true,
        contentHash: true,
        publishedAt: true,
        retiredAt: true,
        retirementReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  listItems(user: SessionUser) {
    return (this.prisma as any).item.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        itemCode: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { code: true, name: true } },
        competency: { select: { code: true, name: true } },
        scale: { select: { code: true, name: true } },
        subscale: { select: { code: true, name: true } },
        versions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            version: true,
            status: true,
            language: true,
            difficulty: true,
            discrimination: true,
            exposureRate: true,
            publishedAt: true,
            retiredAt: true,
          },
        },
      },
    });
  }

  async getItemVersion(user: SessionUser, itemVersionId: string) {
    const itemVersion = await (this.prisma as any).itemVersion.findFirst({
      where: {
        id: itemVersionId,
        item: { organizationId: user.organizationId },
      },
      include: {
        item: {
          include: {
            category: true,
            competency: true,
            scale: true,
            subscale: true,
          },
        },
      },
    });
    if (!itemVersion) throw new NotFoundException('Versión de reactivo no disponible.');

    return {
      ...itemVersion,
      scoringKeyJson: undefined,
      hasScoringKey: Boolean(itemVersion.scoringKeyJson),
      sensitiveFieldsRedacted: true,
    };
  }

  async getAssessmentVersionDetail(user: SessionUser, assessmentVersionId: string) {
    const version = await (this.prisma as any).assessmentVersion.findFirst({
      where: { id: assessmentVersionId, organizationId: user.organizationId },
      include: {
        assessment: { select: { id: true, code: true, name: true, description: true, status: true } },
        itemLinks: {
          orderBy: { sortOrder: 'asc' },
          include: {
            itemVersion: {
              include: {
                item: {
                  include: {
                    category: true,
                    competency: true,
                    scale: true,
                    subscale: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!version) throw new NotFoundException('Versión de prueba no disponible.');

    const authors = await this.findUsersByIds([version.createdByUserId, version.approvedByUserId]);
    const readiness = await this.validateVersionReadiness(user, 'assessmentVersion', assessmentVersionId);
    const linkedItems = version.itemLinks.map((link) => this.redactAssessmentVersionItem(link));

    return {
      ...version,
      createdBy: this.userSummary(authors.get(version.createdByUserId)),
      approvedBy: this.userSummary(authors.get(version.approvedByUserId)),
      itemLinks: linkedItems,
      competencies: this.uniqueByName(linkedItems.map((link) => link.itemVersion.item.competency)),
      scales: this.uniqueByName(linkedItems.map((link) => link.itemVersion.item.scale)),
      subscales: this.uniqueByName(linkedItems.map((link) => link.itemVersion.item.subscale)),
      readiness,
    };
  }

  async getItemVersionDetail(user: SessionUser, itemVersionId: string) {
    const itemVersion = await (this.prisma as any).itemVersion.findFirst({
      where: {
        id: itemVersionId,
        item: { organizationId: user.organizationId },
      },
      include: {
        item: {
          include: {
            category: true,
            competency: true,
            scale: true,
            subscale: true,
          },
        },
      },
    });
    if (!itemVersion) throw new NotFoundException('Versión de reactivo no disponible.');

    const authors = await this.findUsersByIds([itemVersion.createdByUserId, itemVersion.approvedByUserId]);
    const readiness = await this.validateVersionReadiness(user, 'itemVersion', itemVersionId);

    return {
      ...itemVersion,
      scoringKeyJson: undefined,
      hasScoringKey: Boolean(itemVersion.scoringKeyJson),
      sensitiveFieldsRedacted: true,
      createdBy: this.userSummary(authors.get(itemVersion.createdByUserId)),
      approvedBy: this.userSummary(authors.get(itemVersion.approvedByUserId)),
      readiness,
    };
  }

  async getEditorialHistory(user: SessionUser, model: string, versionId: string) {
    await this.assertVersionInTenant(user.organizationId, model, versionId);
    return (this.prisma as any).auditEvent.findMany({
      where: {
        organizationId: user.organizationId,
        resourceType: model,
        resourceId: versionId,
        action: { startsWith: 'psychometric.' },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        actorUserId: true,
        actorType: true,
        action: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async validateVersionReadiness(user: SessionUser, model: string, versionId: string) {
    await this.assertVersionInTenant(user.organizationId, model, versionId);
    if (model === 'assessmentVersion') return this.validateAssessmentVersionReadiness(user.organizationId, versionId);
    if (model === 'itemVersion') return this.validateItemVersionReadiness(user.organizationId, versionId);
    return {
      ready: true,
      blockingIssues: [],
      warnings: ['La validación avanzada para este tipo de versión todavía no está implementada.'],
    };
  }

  async updateDraftVersion(user: SessionUser, dto: UpdateDraftVersionDto) {
    const current = await this.assertVersionInTenant(user.organizationId, dto.model, dto.versionId, {
      id: true,
      status: true,
    });
    if (!['DRAFT', 'INTERNAL_REVIEW'].includes(current.status)) {
      throw new BadRequestException('Solo se pueden editar versiones en DRAFT o INTERNAL_REVIEW.');
    }
    const updated = await this.versioning.updateDraftVersion({
      organizationId: user.organizationId,
      model: dto.model,
      id: dto.versionId,
      data: dto.data,
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorUserId: user.userId,
      actorType: 'STAFF',
      action: 'psychometric.console.version.updated',
      resourceType: dto.model,
      resourceId: dto.versionId,
      metadata: { keys: Object.keys(dto.data || {}) },
    });
    return updated;
  }

  async executeWorkflowAction(user: SessionUser, dto: EditorialActionDto) {
    await this.assertVersionInTenant(user.organizationId, dto.model, dto.versionId);

    switch (dto.action) {
      case EditorialAction.RequestInternalReview:
        return this.versioning.requestInternalReview({
          organizationId: user.organizationId,
          model: dto.model,
          id: dto.versionId,
          actorUserId: user.userId,
          reason: dto.reason,
        });
      case EditorialAction.RequestPsychologistReview:
        return this.versioning.requestPsychologistReview({
          organizationId: user.organizationId,
          model: dto.model,
          id: dto.versionId,
          actorUserId: user.userId,
          reason: dto.reason,
        });
      case EditorialAction.Approve:
        return this.versioning.approve({
          organizationId: user.organizationId,
          model: dto.model,
          id: dto.versionId,
          actorUserId: user.userId,
          reason: dto.reason,
        });
      case EditorialAction.Publish:
        await this.assertReadyForPublish(user, dto.model, dto.versionId);
        return this.versioning.publish({
          organizationId: user.organizationId,
          model: dto.model,
          id: dto.versionId,
          actorUserId: user.userId,
          reason: dto.reason,
        });
      case EditorialAction.Retire:
        return this.versioning.retire({
          organizationId: user.organizationId,
          model: dto.model,
          id: dto.versionId,
          actorUserId: user.userId,
          reason: dto.reason,
        });
      case EditorialAction.ReturnToDraft:
        if (!dto.reason?.trim()) {
          throw new BadRequestException('Devolver a borrador requiere comentario.');
        }
        return this.versioning.transitionVersion({
          organizationId: user.organizationId,
          model: dto.model,
          id: dto.versionId,
          actorUserId: user.userId,
          toStatus: 'DRAFT',
          reason: dto.reason,
        });
      default:
        throw new BadRequestException('Acción editorial no soportada.');
    }
  }

  async createVersionFromPublished(user: SessionUser, dto: CreateVersionFromPublishedDto) {
    await this.assertVersionInTenant(user.organizationId, dto.model, dto.sourceVersionId);
    return this.versioning.createNewVersionFromPublished({
      organizationId: user.organizationId,
      model: dto.model,
      sourceVersionId: dto.sourceVersionId,
      newVersion: dto.newVersion,
      actorUserId: user.userId,
      overrides: dto.overrides,
    });
  }

  private async assertReadyForPublish(user: SessionUser, model: string, versionId: string) {
    const readiness = await this.validateVersionReadiness(user, model, versionId);
    if (!readiness.ready) {
      throw new BadRequestException({
        message: 'La versión no está lista para publicación.',
        blockingIssues: readiness.blockingIssues,
        warnings: readiness.warnings,
      });
    }
  }

  private async validateAssessmentVersionReadiness(organizationId: string, assessmentVersionId: string) {
    const version = await (this.prisma as any).assessmentVersion.findFirst({
      where: { id: assessmentVersionId, organizationId },
      include: {
        itemLinks: {
          include: {
            itemVersion: {
              include: { item: true },
            },
          },
        },
      },
    });
    if (!version) throw new NotFoundException('Versión de prueba no disponible.');

    const blockingIssues: string[] = [];
    const warnings: string[] = [];
    if (version.itemLinks.length === 0) {
      blockingIssues.push('La prueba no tiene reactivos vinculados.');
    }

    for (const link of version.itemLinks) {
      const itemVersion = link.itemVersion;
      const item = itemVersion.item;
      const label = item?.itemCode || itemVersion.id;
      if (!['PUBLISHED', 'ACTIVE'].includes(itemVersion.status)) {
        blockingIssues.push(`El reactivo ${label} no está publicado/activo.`);
      }
      if (item?.status && !['ACTIVE', 'PUBLISHED'].includes(item.status)) {
        blockingIssues.push(`El reactivo ${label} no está activo a nivel de banco.`);
      }
      if (!item?.competencyId) warnings.push(`El reactivo ${label} no tiene competencia asociada.`);
      if (!item?.scaleId) warnings.push(`El reactivo ${label} no tiene escala asociada.`);
      if (!itemVersion.stemJson) blockingIssues.push(`El reactivo ${label} no tiene contenido.`);
    }

    return { ready: blockingIssues.length === 0, blockingIssues, warnings };
  }

  private async validateItemVersionReadiness(organizationId: string, itemVersionId: string) {
    const itemVersion = await (this.prisma as any).itemVersion.findFirst({
      where: { id: itemVersionId, item: { organizationId } },
      include: { item: true },
    });
    if (!itemVersion) throw new NotFoundException('Versión de reactivo no disponible.');

    const blockingIssues: string[] = [];
    const warnings: string[] = [];
    if (!itemVersion.stemJson) blockingIssues.push('El reactivo no tiene contenido.');
    if (!itemVersion.language) blockingIssues.push('El reactivo no tiene idioma.');
    if (!itemVersion.contentHash) blockingIssues.push('El reactivo no tiene hash de contenido.');
    if (!itemVersion.item?.competencyId) warnings.push('El reactivo no tiene competencia asociada.');
    if (!itemVersion.item?.scaleId) warnings.push('El reactivo no tiene escala asociada.');
    if (itemVersion.difficulty === null || itemVersion.difficulty === undefined) {
      warnings.push('El reactivo no tiene dificultad estimada.');
    }
    if (itemVersion.discrimination === null || itemVersion.discrimination === undefined) {
      warnings.push('El reactivo no tiene discriminación estimada.');
    }
    if (!itemVersion.expectedTimeSeconds) warnings.push('El reactivo no tiene tiempo esperado.');

    return { ready: blockingIssues.length === 0, blockingIssues, warnings };
  }

  private async assertVersionInTenant(
    organizationId: string,
    model: string,
    versionId: string,
    select: Record<string, boolean> = { id: true },
  ) {
    const where = this.tenantWhereForVersion(organizationId, model, versionId);
    const found = await (this.prisma as any)[model].findFirst({ where, select });
    if (!found) throw new NotFoundException('Versión no disponible.');
    return found;
  }

  private tenantWhereForVersion(organizationId: string, model: string, versionId: string) {
    if (model === 'assessmentVersion') return { id: versionId, organizationId };
    if (model === 'itemVersion') return { id: versionId, item: { organizationId } };
    if (model === 'normGroupVersion') return { id: versionId, normGroup: { organizationId } };
    if (model === 'scoringModelVersion') return { id: versionId, scoringModel: { organizationId } };
    if (model === 'reportTemplateVersion') return { id: versionId, reportTemplate: { organizationId } };
    throw new BadRequestException('Tipo de versión no soportado.');
  }

  private async findUsersByIds(ids: Array<string | null | undefined>) {
    const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
    if (uniqueIds.length === 0) return new Map<string, any>();
    const users = await (this.prisma as any).user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, email: true, name: true },
    });
    return new Map(users.map((user) => [user.id, user]));
  }

  private userSummary(user?: any) {
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name };
  }

  private uniqueByName(values: any[]) {
    const map = new Map<string, any>();
    for (const value of values) {
      if (value?.name) map.set(value.name, value);
    }
    return Array.from(map.values());
  }

  private redactAssessmentVersionItem(link: any) {
    return {
      sortOrder: link.sortOrder,
      weight: link.weight,
      role: link.role,
      itemVersion: {
        ...link.itemVersion,
        scoringKeyJson: undefined,
        hasScoringKey: Boolean(link.itemVersion.scoringKeyJson),
        sensitiveFieldsRedacted: true,
      },
    };
  }
}
