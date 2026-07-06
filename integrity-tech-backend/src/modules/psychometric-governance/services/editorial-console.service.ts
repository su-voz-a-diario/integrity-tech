import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../audit/services/audit.service';
import { SessionUser } from '../../iam';
import {
  CreateAssessmentDto,
  CreateItemDto,
  CreateVersionFromPublishedDto,
  EditorialAction,
  EditorialActionDto,
  SetAssessmentVersionItemsDto,
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

  async createAssessment(user: SessionUser, dto: CreateAssessmentDto) {
    const code = dto.code.trim();
    const name = dto.name.trim();
    if (!code || !name) throw new BadRequestException('Código y nombre de evaluación son obligatorios.');

    const scientificDescription = dto.scientificDescription?.trim() || dto.description?.trim() || undefined;
    const blueprintJson = {
      source: 'test_builder',
      assessmentCode: code,
      shortName: dto.shortName?.trim() || undefined,
      scientificDescription,
      constructObjective: dto.constructObjective?.trim() || undefined,
      candidateInstructions: dto.candidateInstructions?.trim() || undefined,
      estimatedTimeMinutes: dto.estimatedTimeMinutes || undefined,
      author: dto.author?.trim() || undefined,
      scientificReferences: dto.scientificReferences || undefined,
      language: dto.language?.trim() || 'es',
      factors: dto.factors || [],
      facets: dto.facets || [],
      responseTypes: dto.responseTypes || [],
      scoringConfig: dto.scoringConfig || {
        facetScore: 'sum',
        globalScore: 'sum',
        randomizeItems: false,
        randomizeFacets: false,
        cutScores: [],
      },
      normingConfig: dto.normingConfig || { enabled: false, status: 'not_configured' },
      reportConfig: dto.reportConfig || { sections: [] },
    };

    const assessment = await (this.prisma as any).assessment.create({
      data: {
        organizationId: user.organizationId,
        code,
        name,
        description: scientificDescription || null,
        status: 'DRAFT',
        createdByUserId: user.userId,
      },
    });

    const initialVersion = await this.versioning.createAssessmentVersion({
      organizationId: user.organizationId,
      assessmentId: assessment.id,
      version: '1.0.0',
      title: name,
      description: scientificDescription,
      blueprintJson,
      createdByUserId: user.userId,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorUserId: user.userId,
      actorType: 'STAFF',
      action: 'psychometric.assessment.created',
      resourceType: 'ASSESSMENT',
      resourceId: assessment.id,
      metadata: { code, initialVersionId: initialVersion.id },
    });

    return { assessment, initialVersion };
  }


  async createItem(user: SessionUser, dto: CreateItemDto) {
    const itemCode = dto.itemCode.trim();
    if (!itemCode) throw new BadRequestException('El código del reactivo es obligatorio.');

    const category = await this.findOrCreateCategory(user.organizationId, dto.category);
    const competency = await this.findOrCreateCompetency(user.organizationId, dto.competency);
    const scale = await this.findOrCreateScale(user.organizationId, dto.scale);
    const subscale = await this.findOrCreateSubscale(scale?.id, dto.subscale);

    const item = await (this.prisma as any).item.create({
      data: {
        organizationId: user.organizationId,
        itemCode,
        status: 'DRAFT',
        categoryId: category?.id || null,
        competencyId: competency?.id || null,
        scaleId: scale?.id || null,
        subscaleId: subscale?.id || null,
        createdByUserId: user.userId,
      },
    });

    const responseType = dto.responseType?.trim() || (dto.stemJson?.responseType as string | undefined) || 'LIKERT_5_AGREEMENT';
    const stemJson = {
      ...dto.stemJson,
      type: (dto.stemJson?.type as string | undefined) || responseType,
      responseType,
      prompt: dto.text?.trim() || (dto.stemJson?.prompt as string | undefined) || (dto.stemJson?.text as string | undefined),
      text: dto.text?.trim() || (dto.stemJson?.text as string | undefined) || (dto.stemJson?.prompt as string | undefined),
      factor: dto.scale?.trim() || (dto.stemJson?.factor as string | undefined),
      facet: dto.subscale?.trim() || (dto.stemJson?.facet as string | undefined),
      isReverseScored: dto.isReverseScored ?? (dto.stemJson?.isReverseScored as boolean | undefined) ?? false,
      order: dto.order ?? (dto.stemJson?.order as number | undefined),
      authorNotes: dto.authorNotes?.trim() || (dto.stemJson?.authorNotes as string | undefined),
      scientificMetadata: {
        constructMeasured: dto.constructMeasured?.trim() || undefined,
        observableBehavior: dto.observableBehavior?.trim() || undefined,
        itemHypothesis: dto.itemHypothesis?.trim() || undefined,
        scientificSource: dto.scientificSource?.trim() || undefined,
        bibliographyReference: dto.bibliographyReference?.trim() || undefined,
        doi: dto.doi?.trim() || undefined,
        ...(typeof dto.stemJson?.scientificMetadata === 'object' && dto.stemJson.scientificMetadata ? dto.stemJson.scientificMetadata : {}),
      },
      futureMetrics: {
        discrimination: dto.discrimination ?? null,
        difficulty: dto.difficulty ?? null,
        alphaIfDeleted: null,
        irtParameters: null,
        dif: null,
        calibratedAt: null,
        ...(typeof dto.stemJson?.futureMetrics === 'object' && dto.stemJson.futureMetrics ? dto.stemJson.futureMetrics : {}),
      },
    };
    const scoringKeyJson = dto.scoringKeyJson || {
      scoring: 'CONFIGURED_IN_TEST_BUILDER',
      responseType,
      isReverseScored: stemJson.isReverseScored,
    };
    const tags = {
      ...(dto.tags || {}),
      factor: dto.scale?.trim() || undefined,
      facet: dto.subscale?.trim() || undefined,
      constructMeasured: dto.constructMeasured?.trim() || undefined,
      source: 'test_builder',
    };

    const itemVersion = await this.versioning.createItemVersion({
      organizationId: user.organizationId,
      itemId: item.id,
      version: dto.version?.trim() || '1.0.0',
      language: dto.language?.trim() || 'es',
      stemJson,
      scoringKeyJson,
      tags,
      difficulty: dto.difficulty,
      discrimination: dto.discrimination,
      expectedTimeSeconds: dto.expectedTimeSeconds,
      createdByUserId: user.userId,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorUserId: user.userId,
      actorType: 'STAFF',
      action: 'psychometric.item.created',
      resourceType: 'ITEM',
      resourceId: item.id,
      metadata: { itemCode, initialVersionId: itemVersion.id },
    });

    return { item, itemVersion };
  }

  async setAssessmentVersionItems(
    user: SessionUser,
    assessmentVersionId: string,
    dto: SetAssessmentVersionItemsDto,
  ) {
    const version = await (this.prisma as any).assessmentVersion.findFirst({
      where: { id: assessmentVersionId, organizationId: user.organizationId },
      select: { id: true, status: true },
    });
    if (!version) throw new NotFoundException('Versión de prueba no disponible.');
    if (!['DRAFT', 'INTERNAL_REVIEW'].includes(version.status)) {
      throw new BadRequestException('Solo se pueden vincular reactivos en versiones DRAFT o INTERNAL_REVIEW.');
    }

    const uniqueItems = Array.from(new Map((dto.items || []).map((item, index) => [
      item.itemVersionId,
      {
        itemVersionId: item.itemVersionId,
        sortOrder: item.sortOrder ?? index,
        weight: item.weight ?? 1,
        role: item.role?.trim() || 'SCORED',
      },
    ])).values());

    if (uniqueItems.length > 0) {
      const found = await (this.prisma as any).itemVersion.findMany({
        where: {
          id: { in: uniqueItems.map((item) => item.itemVersionId) },
          item: { organizationId: user.organizationId },
        },
        select: { id: true },
      });
      if (found.length !== uniqueItems.length) {
        throw new NotFoundException('Uno o más reactivos no están disponibles para esta organización.');
      }
    }

    await this.prisma.$transaction([
      (this.prisma as any).assessmentVersionItem.deleteMany({
        where: { assessmentVersionId, assessmentVersion: { organizationId: user.organizationId } },
      }),
      ...uniqueItems.map((item) =>
        (this.prisma as any).assessmentVersionItem.create({
          data: {
            assessmentVersionId,
            itemVersionId: item.itemVersionId,
            sortOrder: item.sortOrder,
            weight: item.weight,
            role: item.role,
          },
        }),
      ),
    ]);

    await this.audit.record({
      organizationId: user.organizationId,
      actorUserId: user.userId,
      actorType: 'STAFF',
      action: 'psychometric.assessment_version.items_set',
      resourceType: 'assessmentVersion',
      resourceId: assessmentVersionId,
      metadata: { itemVersionIds: uniqueItems.map((item) => item.itemVersionId) },
    });

    return this.getAssessmentVersionDetail(user, assessmentVersionId);
  }

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
            stemJson: true,
            tags: true,
            difficulty: true,
            discrimination: true,
            expectedTimeSeconds: true,
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
      case EditorialAction.Publish: {
        await this.assertReadyForPublish(user, dto.model, dto.versionId);
        const published = await this.versioning.publish({
          organizationId: user.organizationId,
          model: dto.model,
          id: dto.versionId,
          actorUserId: user.userId,
          reason: dto.reason,
        });
        if (dto.model === 'assessmentVersion') {
          await this.publishAssessmentVersionToExam(user, dto.versionId);
        }
        return published;
      }
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


  private async findOrCreateCategory(organizationId: string, name?: string) {
    const normalized = this.normalizeTaxonomyName(name);
    if (!normalized) return null;
    return (this.prisma as any).psychometricCategory.upsert({
      where: { organizationId_code: { organizationId, code: normalized.code } },
      update: { name: normalized.name },
      create: { organizationId, code: normalized.code, name: normalized.name },
    });
  }

  private async findOrCreateCompetency(organizationId: string, name?: string) {
    const normalized = this.normalizeTaxonomyName(name);
    if (!normalized) return null;
    return (this.prisma as any).competency.upsert({
      where: { organizationId_code: { organizationId, code: normalized.code } },
      update: { name: normalized.name },
      create: { organizationId, code: normalized.code, name: normalized.name },
    });
  }

  private async findOrCreateScale(organizationId: string, name?: string) {
    const normalized = this.normalizeTaxonomyName(name);
    if (!normalized) return null;
    return (this.prisma as any).psychometricScale.upsert({
      where: { organizationId_code: { organizationId, code: normalized.code } },
      update: { name: normalized.name },
      create: { organizationId, code: normalized.code, name: normalized.name },
    });
  }

  private async findOrCreateSubscale(scaleId?: string, name?: string) {
    const normalized = this.normalizeTaxonomyName(name);
    if (!scaleId || !normalized) return null;
    return (this.prisma as any).psychometricSubscale.upsert({
      where: { scaleId_code: { scaleId, code: normalized.code } },
      update: { name: normalized.name },
      create: { scaleId, code: normalized.code, name: normalized.name },
    });
  }

  private normalizeTaxonomyName(name?: string) {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const code = trimmed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
      .slice(0, 80);
    return { name: trimmed, code: code || trimmed.slice(0, 80).toUpperCase() };
  }

  private async publishAssessmentVersionToExam(user: SessionUser, assessmentVersionId: string) {
    const version = await (this.prisma as any).assessmentVersion.findFirst({
      where: { id: assessmentVersionId, organizationId: user.organizationId, status: 'PUBLISHED' },
      include: {
        assessment: true,
        itemLinks: {
          orderBy: { sortOrder: 'asc' },
          include: { itemVersion: true },
        },
      },
    });
    if (!version) throw new NotFoundException('Versión publicada no disponible.');

    const examId = version.assessment.id;
    const existingExam = await (this.prisma as any).exam.findFirst({
      where: { id: examId, organizationId: user.organizationId },
      select: { id: true },
    });

    if (existingExam) {
      await (this.prisma as any).exam.update({
        where: { id: examId },
        data: {
          title: version.title || version.assessment.name,
          description: version.description || version.assessment.description || null,
          isPublished: true,
        },
      });
    } else {
      await (this.prisma as any).exam.create({
        data: {
          id: examId,
          organizationId: user.organizationId,
          title: version.title || version.assessment.name,
          description: version.description || version.assessment.description || null,
          isPublished: true,
          createdBy: user.userId,
        },
      });
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorUserId: user.userId,
      actorType: 'STAFF',
      action: 'psychometric.assessment_version.published_to_exam',
      resourceType: 'exam',
      resourceId: examId,
      metadata: { assessmentVersionId, assessmentId: version.assessment.id },
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

    const blueprint = (version.blueprintJson || {}) as any;
    if (blueprint.source === 'test_builder') {
      const factors = Array.isArray(blueprint.factors) ? blueprint.factors.filter((factor: any) => factor?.active !== false) : [];
      const facets = Array.isArray(blueprint.facets) ? blueprint.facets.filter((facet: any) => facet?.active !== false) : [];
      const factorCodes = new Set<string>();
      const facetCodes = new Set<string>();
      for (const factor of factors) {
        if (!factor?.name || !factor?.code) blockingIssues.push('Todos los factores deben tener nombre y código.');
        if (factorCodes.has(factor.code)) blockingIssues.push(`Código de factor duplicado: ${factor.code}.`);
        if (factor.code) factorCodes.add(factor.code);
      }
      for (const facet of facets) {
        if (!facet?.name || !facet?.code) blockingIssues.push('Todas las facetas deben tener nombre y código.');
        if (facetCodes.has(facet.code)) blockingIssues.push(`Código de faceta duplicado: ${facet.code}.`);
        if (facet.code) facetCodes.add(facet.code);
      }
      if (factors.length === 0) blockingIssues.push('La versión debe tener al menos un factor activo.');
      if (facets.length === 0) blockingIssues.push('La versión debe tener al menos una faceta activa.');
      if (!blueprint.candidateInstructions) blockingIssues.push('La versión debe tener instrucciones para el candidato.');
      if (!blueprint.scoringConfig || typeof blueprint.scoringConfig !== 'object') blockingIssues.push('La versión debe tener configuración de corrección.');
      const interpretations = blueprint.interpretations;
      const hasInterpretations = interpretations && typeof interpretations === 'object' && Object.values(interpretations).some((ranges: any) => Array.isArray(ranges) && ranges.length > 0);
      if (!hasInterpretations) blockingIssues.push('La versión debe tener interpretaciones configuradas por faceta.');
      const activeFacetCodes = new Set(facets.map((facet: any) => facet.code).filter(Boolean));
      for (const facet of facets) {
        const linkedCount = version.itemLinks.filter((link: any) => {
          const stem = link.itemVersion?.stemJson || {};
          const tags = link.itemVersion?.tags || {};
          return stem.facet === facet.name || stem.facetCode === facet.code || tags.facet === facet.name || tags.facetCode === facet.code;
        }).length;
        if (linkedCount === 0) blockingIssues.push(`La faceta ${facet.name || facet.code} no tiene reactivos vinculados.`);
      }
      for (const link of version.itemLinks) {
        const stem = link.itemVersion?.stemJson || {};
        if (!stem.responseType && !stem.type) blockingIssues.push(`El reactivo ${link.itemVersion?.item?.itemCode || link.itemVersionId} no tiene tipo de respuesta.`);
        if (link.sortOrder === null || link.sortOrder === undefined) blockingIssues.push(`El reactivo ${link.itemVersion?.item?.itemCode || link.itemVersionId} no tiene orden.`);
        const facetCode = stem.facetCode || link.itemVersion?.tags?.facetCode;
        if (facetCode && !activeFacetCodes.has(facetCode)) warnings.push(`El reactivo ${link.itemVersion?.item?.itemCode || link.itemVersionId} referencia una faceta no activa.`);
      }
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
      if (!itemVersion.stemJson) {
        blockingIssues.push(`El reactivo ${label} no tiene contenido.`);
      }
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
