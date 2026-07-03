import { BadRequestException } from '@nestjs/common';
import { EditorialAction, EditorialVersionModel } from '../dto/editorial-console.dto';
import { EditorialConsoleService } from './editorial-console.service';

describe('EditorialConsoleService', () => {
  const user = {
    userId: 'admin',
    organizationId: 'org-1',
    email: 'admin@integrity.demo',
    roles: ['admin'],
  };

  let prisma: any;
  let versioning: any;
  let audit: any;
  let service: EditorialConsoleService;

  beforeEach(() => {
    prisma = {
      itemVersion: {
        findFirst: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      assessmentVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'av-1' }),
      },
    };
    versioning = {
      updateDraftVersion: jest.fn(),
      publish: jest.fn().mockResolvedValue({ id: 'av-1', status: 'PUBLISHED' }),
      retire: jest.fn().mockResolvedValue({ id: 'av-1', status: 'RETIRED' }),
      createNewVersionFromPublished: jest.fn(),
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new EditorialConsoleService(prisma, versioning, audit);
  });

  it('redacts item scoring keys from item version detail', async () => {
    prisma.itemVersion.findFirst.mockResolvedValue({
      id: 'iv-1',
      scoringKeyJson: { correctOptionId: 'secret' },
      item: { organizationId: user.organizationId },
    });

    const result = await service.getItemVersion(user, 'iv-1');

    expect(result.scoringKeyJson).toBeUndefined();
    expect(result.hasScoringKey).toBe(true);
    expect(result.sensitiveFieldsRedacted).toBe(true);
  });

  it('publishes through versioning service and audit is generated there', async () => {
    prisma.assessmentVersion.findFirst
      .mockResolvedValueOnce({ id: 'av-1' })
      .mockResolvedValueOnce({ id: 'av-1' })
      .mockResolvedValueOnce({
        id: 'av-1',
        itemLinks: [
          {
            itemVersion: {
              id: 'iv-1',
              status: 'PUBLISHED',
              stemJson: { prompt: 'Pregunta' },
              item: { itemCode: 'ITEM-1', status: 'ACTIVE', competencyId: 'comp-1', scaleId: 'scale-1' },
            },
          },
        ],
      });

    await service.executeWorkflowAction(user, {
      model: EditorialVersionModel.AssessmentVersion,
      versionId: 'av-1',
      action: EditorialAction.Publish,
    });

    expect(versioning.publish).toHaveBeenCalledWith({
      organizationId: user.organizationId,
      model: 'assessmentVersion',
      id: 'av-1',
      actorUserId: user.userId,
      reason: undefined,
    });
  });

  it('retire requires reason through workflow service', async () => {
    versioning.retire.mockRejectedValue(new BadRequestException('Retirar una versión requiere registrar una razón.'));

    await expect(
      service.executeWorkflowAction(user, {
        model: EditorialVersionModel.AssessmentVersion,
        versionId: 'av-1',
        action: EditorialAction.Retire,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not edit a published version through API service', async () => {
    prisma.assessmentVersion.findFirst.mockResolvedValue({ id: 'av-1', status: 'PUBLISHED' });
    versioning.updateDraftVersion.mockRejectedValue(
      new BadRequestException('Los artefactos publicados son inmutables; crea una nueva versión.'),
    );

    await expect(
      service.updateDraftVersion(user, {
        model: EditorialVersionModel.AssessmentVersion,
        versionId: 'av-1',
        data: { title: 'Cambio no permitido' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('edits a draft version through API service', async () => {
    prisma.assessmentVersion.findFirst.mockResolvedValue({ id: 'av-1', status: 'DRAFT' });
    versioning.updateDraftVersion.mockResolvedValue({ id: 'av-1', title: 'Nuevo título' });

    await service.updateDraftVersion(user, {
      model: EditorialVersionModel.AssessmentVersion,
      versionId: 'av-1',
      data: { title: 'Nuevo título' },
    });

    expect(versioning.updateDraftVersion).toHaveBeenCalledWith({
      model: 'assessmentVersion',
      id: 'av-1',
      data: { title: 'Nuevo título' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'psychometric.console.version.updated' }),
    );
  });

  it('publication fails when assessment version has no items', async () => {
    prisma.assessmentVersion.findFirst
      .mockResolvedValueOnce({ id: 'av-1' })
      .mockResolvedValueOnce({ id: 'av-1' })
      .mockResolvedValueOnce({ id: 'av-1', itemLinks: [] });

    await expect(
      service.executeWorkflowAction(user, {
        model: EditorialVersionModel.AssessmentVersion,
        versionId: 'av-1',
        action: EditorialAction.Publish,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(versioning.publish).not.toHaveBeenCalled();
  });

  it('publication fails when assessment has non publishable items', async () => {
    prisma.assessmentVersion.findFirst
      .mockResolvedValueOnce({ id: 'av-1' })
      .mockResolvedValueOnce({ id: 'av-1' })
      .mockResolvedValueOnce({
        id: 'av-1',
        itemLinks: [
          {
            itemVersion: {
              id: 'iv-1',
              status: 'DRAFT',
              stemJson: { prompt: 'Pregunta' },
              item: { itemCode: 'ITEM-1', status: 'ACTIVE', competencyId: 'comp-1', scaleId: 'scale-1' },
            },
          },
        ],
      });

    await expect(
      service.executeWorkflowAction(user, {
        model: EditorialVersionModel.AssessmentVersion,
        versionId: 'av-1',
        action: EditorialAction.Publish,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns editorial history for tenant-scoped version', async () => {
    prisma.auditEvent.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'psychometric.version.transitioned',
        metadata: { from: 'INTERNAL_REVIEW', to: 'DRAFT', reason: 'Ajustar redacción' },
      },
    ]);

    const result = await service.getEditorialHistory(user, 'assessmentVersion', 'av-1');

    expect(result).toHaveLength(1);
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: user.organizationId,
          resourceType: 'assessmentVersion',
          resourceId: 'av-1',
        }),
      }),
    );
  });

  it('uses tenant filter in assessment version deep detail', async () => {
    prisma.assessmentVersion.findFirst.mockResolvedValue({
      id: 'av-1',
      createdByUserId: null,
      approvedByUserId: null,
      itemLinks: [],
    });

    await service.getAssessmentVersionDetail(user, 'av-1');

    expect(prisma.assessmentVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'av-1', organizationId: user.organizationId },
      }),
    );
  });

  it('return to draft requires comment', async () => {
    await expect(
      service.executeWorkflowAction(user, {
        model: EditorialVersionModel.AssessmentVersion,
        versionId: 'av-1',
        action: EditorialAction.ReturnToDraft,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
