import { PsychometricWorkflowService } from './psychometric-workflow.service';
import { PsychometricVersioningService } from './psychometric-versioning.service';
import { ScientificTraceService } from './scientific-trace.service';
import { EvaluationGovernanceResolverService } from './evaluation-governance-resolver.service';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Psychometric governance foundation', () => {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows only valid editorial transitions', () => {
    const workflow = new PsychometricWorkflowService();

    expect(() => workflow.assertCanTransition('DRAFT', 'INTERNAL_REVIEW')).not.toThrow();
    expect(() => workflow.assertCanTransition('DRAFT', 'PUBLISHED')).toThrow(
      'Transición editorial inválida',
    );
  });

  it('blocks mutation of published versions', async () => {
    const prisma = {
      assessmentVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'av-1', status: 'PUBLISHED' }),
      },
    };
    const service = new PsychometricVersioningService(
      prisma as any,
      audit as any,
      new PsychometricWorkflowService(),
    );

    await expect(service.assertVersionMutable('assessmentVersion', 'av-1', 'org-1')).rejects.toThrow(
      'Los artefactos publicados son inmutables',
    );
  });

  it('blocks mutation of published item versions', async () => {
    const prisma = {
      itemVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'iv-1', status: 'ACTIVE' }),
      },
    };
    const service = new PsychometricVersioningService(
      prisma as any,
      audit as any,
      new PsychometricWorkflowService(),
    );

    await expect(service.assertVersionMutable('itemVersion', 'iv-1', 'org-1')).rejects.toThrow(
      'Los artefactos publicados son inmutables',
    );
  });


  it('scopes version transitions by organization internally', async () => {
    const prisma = {
      assessmentVersion: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new PsychometricVersioningService(
      prisma as any,
      audit as any,
      new PsychometricWorkflowService(),
    );

    await expect(
      service.publish({
        organizationId: 'org-1',
        model: 'assessmentVersion',
        id: 'av-other-tenant',
        actorUserId: 'staff-1',
      }),
    ).rejects.toThrow('Versión no disponible');

    expect(prisma.assessmentVersion.findFirst).toHaveBeenCalledWith({
      where: { id: 'av-other-tenant', organizationId: 'org-1' },
    });
  });

  it('creates item versions with content hash and draft status', async () => {
    const prisma = {
      item: { findFirst: jest.fn().mockResolvedValue({ id: 'item-1', organizationId: 'org-1' }) },
      itemVersion: {
        create: jest.fn().mockResolvedValue({ id: 'iv-1', status: 'DRAFT' }),
      },
    };
    const service = new PsychometricVersioningService(
      prisma as any,
      audit as any,
      new PsychometricWorkflowService(),
    );

    await service.createItemVersion({
      organizationId: 'org-1',
      itemId: 'item-1',
      version: '1.0.0',
      stemJson: { prompt: 'Reactivo de ejemplo' },
      scoringKeyJson: { key: 'A' },
      createdByUserId: 'staff-1',
    });

    expect(prisma.itemVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          contentHash: expect.any(String),
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'psychometric.item_version.created' }),
    );
  });

  it('builds scientific trace from attempt version references', async () => {
    const prisma = {
      examAttempt: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'attempt-1',
          assessmentVersionId: 'assessment-version-1',
          submissions: [{ itemVersionId: 'item-version-1' }, { itemVersionId: 'item-version-1' }],
          resultadosTest: [{ scoringModelVersionId: 'scoring-version-1', normGroupVersionId: 'norm-version-1' }],
          resultadoGlobal: { reportTemplateVersionId: 'template-version-1' },
        }),
      },
    };
    const service = new ScientificTraceService(prisma as any, audit as any);

    const trace = await service.buildAttemptTrace('org-1', 'attempt-1');

    expect(trace).toMatchObject({
      mode: 'VERSIONED',
      assessmentVersionId: 'assessment-version-1',
      itemVersionIds: ['item-version-1'],
      scoringModelVersionId: 'scoring-version-1',
      normGroupVersionId: 'norm-version-1',
      reportTemplateVersionId: 'template-version-1',
    });
  });

  it('validates that itemVersion belongs to attempt assessment version', async () => {
    const prisma = {
      examAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          assessmentVersionId: 'assessment-version-1',
          organizationId: 'org-1',
          examId: 'exam-1',
        }),
      },
      assessmentVersionItem: {
        findFirst: jest.fn().mockResolvedValue({ itemVersionId: 'item-version-1' }),
      },
    };
    const service = new EvaluationGovernanceResolverService(prisma as any);

    const result = await service.validateItemVersionBelongsToAttempt({
      attemptId: 'attempt-1',
      questionId: 'question-1',
      itemVersionId: 'item-version-1',
    });

    expect(result).toBe(true);
    expect(prisma.assessmentVersionItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assessmentVersionId: 'assessment-version-1',
          itemVersionId: 'item-version-1',
        }),
      }),
    );
  });

  it('rejects itemVersion outside attempt assessment version', async () => {
    const prisma = {
      examAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          assessmentVersionId: 'assessment-version-1',
          organizationId: 'org-1',
          examId: 'exam-1',
        }),
      },
      assessmentVersionItem: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new EvaluationGovernanceResolverService(prisma as any);

    await expect(
      service.validateItemVersionBelongsToAttempt({
        attemptId: 'attempt-1',
        questionId: 'question-1',
        itemVersionId: 'other-item-version',
      }),
    ).resolves.toBe(false);
  });

  it('does not publish without approval', async () => {
    const prisma = {
      assessmentVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'av-1', status: 'DRAFT' }),
      },
    };
    const service = new PsychometricVersioningService(
      prisma as any,
      audit as any,
      new PsychometricWorkflowService(),
    );

    await expect(
      service.publish({
        organizationId: 'org-1',
        model: 'assessmentVersion',
        id: 'av-1',
        actorUserId: 'staff-1',
      }),
    ).rejects.toThrow('Transición editorial inválida');
  });

  it('requires reason when retiring a version', async () => {
    const prisma = {
      assessmentVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'av-1', status: 'PUBLISHED' }),
      },
    };
    const service = new PsychometricVersioningService(
      prisma as any,
      audit as any,
      new PsychometricWorkflowService(),
    );

    await expect(
      service.retire({
        organizationId: 'org-1',
        model: 'assessmentVersion',
        id: 'av-1',
        actorUserId: 'staff-1',
        reason: '',
      }),
    ).rejects.toThrow('Retirar una versión requiere registrar una razón.');
  });

  it('publishes approved versions and records audit event', async () => {
    const prisma = {
      assessmentVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'av-1', status: 'APPROVED' }),
        update: jest.fn().mockResolvedValue({ id: 'av-1', status: 'PUBLISHED' }),
      },
    };
    const service = new PsychometricVersioningService(
      prisma as any,
      audit as any,
      new PsychometricWorkflowService(),
    );

    await service.publish({
      organizationId: 'org-1',
      model: 'assessmentVersion',
      id: 'av-1',
      actorUserId: 'staff-1',
    });

    expect(prisma.assessmentVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PUBLISHED', publishedAt: expect.any(Date) }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'psychometric.version.published' }),
    );
  });

  it('retires published versions with reason and records audit event', async () => {
    const prisma = {
      assessmentVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'av-1', status: 'PUBLISHED' }),
        update: jest.fn().mockResolvedValue({ id: 'av-1', status: 'RETIRED' }),
      },
    };
    const service = new PsychometricVersioningService(
      prisma as any,
      audit as any,
      new PsychometricWorkflowService(),
    );

    await service.retire({
      organizationId: 'org-1',
      model: 'assessmentVersion',
      id: 'av-1',
      actorUserId: 'staff-1',
      reason: 'Nueva versión aprobada',
    });

    expect(prisma.assessmentVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RETIRED',
          retiredAt: expect.any(Date),
          retirementReason: 'Nueva versión aprobada',
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'psychometric.version.retired' }),
    );
  });

  it('creates a new draft version from a published version', async () => {
    const prisma = {
      assessmentVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'av-1',
          assessmentId: 'assessment-1',
          organizationId: 'org-1',
          version: '1.0.0',
          status: 'PUBLISHED',
          title: 'Prueba',
          blueprintJson: { sections: [] },
          contentHash: 'old-hash',
          createdByUserId: 'staff-1',
        }),
        create: jest.fn().mockResolvedValue({ id: 'av-2', status: 'DRAFT', version: '1.1.0' }),
      },
    };
    const service = new PsychometricVersioningService(
      prisma as any,
      audit as any,
      new PsychometricWorkflowService(),
    );

    const created = await service.createNewVersionFromPublished({
      organizationId: 'org-1',
      model: 'assessmentVersion',
      sourceVersionId: 'av-1',
      newVersion: '1.1.0',
      actorUserId: 'staff-2',
      overrides: { title: 'Prueba revisada' },
    });

    expect(created).toEqual(expect.objectContaining({ id: 'av-2' }));
    expect(prisma.assessmentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          version: '1.1.0',
          title: 'Prueba revisada',
        }),
      }),
    );
  });

  it('session item resolver only returns active or published item versions', async () => {
    const prisma = {
      assessmentVersionItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new EvaluationGovernanceResolverService(prisma as any);

    await service.findGovernedSessionItems('assessment-version-1');

    expect(prisma.assessmentVersionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          itemVersion: { status: { in: ['ACTIVE', 'PUBLISHED'] } },
        }),
      }),
    );
  });

  it('migration contains DB trigger protection for published versions', () => {
    const migrationSql = readFileSync(
      join(process.cwd(), 'prisma/migrations/20260702060000_add_psychometric_publication_immutability/migration.sql'),
      'utf8',
    );

    expect(migrationSql).toContain('prevent_published_version_mutation');
    expect(migrationSql).toContain('assessment_versions_publication_immutability');
    expect(migrationSql).toContain('item_versions_publication_immutability');
    expect(migrationSql).toContain('Published psychometric versions are immutable');
  });
});
