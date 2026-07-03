import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function stripCorrectConfig(content: any) {
  if (!content || typeof content !== 'object') return content;
  const { correctConfig, correctAnswer, correctAnswers, ...safeContent } = content;
  return safeContent;
}

function extractScoringKey(content: any) {
  if (!content || typeof content !== 'object') return null;
  return {
    correctConfig: content.correctConfig || null,
    correctAnswer: content.correctAnswer || null,
    correctAnswers: content.correctAnswers || null,
  };
}

async function main() {
  const exams = await prisma.exam.findMany({
    include: {
      examQuestions: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  let assessmentCount = 0;
  let assessmentVersionCount = 0;
  let itemCount = 0;
  let itemVersionCount = 0;
  let linkCount = 0;

  for (const exam of exams) {
    const assessment = await (prisma as any).assessment.upsert({
      where: {
        organizationId_code: {
          organizationId: exam.organizationId,
          code: `EXAM_${exam.id}`,
        },
      },
      update: {
        name: exam.title,
        description: exam.description,
      },
      create: {
        organizationId: exam.organizationId,
        code: `EXAM_${exam.id}`,
        name: exam.title,
        description: exam.description,
        status: exam.isPublished ? 'PUBLISHED' : 'DRAFT',
        createdByUserId: exam.createdBy,
      },
    });
    assessmentCount++;

    if (!exam.isPublished) {
      continue;
    }

    const blueprintJson = {
      legacyExamId: exam.id,
      title: exam.title,
      durationMinutes: exam.durationMinutes,
      maxAttempts: exam.maxAttempts,
      passingScore: String(exam.passingScore),
      itemCount: exam.examQuestions.length,
    };

    const assessmentVersion = await (prisma as any).assessmentVersion.upsert({
      where: {
        assessmentId_version: {
          assessmentId: assessment.id,
          version: '1.0.0',
        },
      },
      update: {},
      create: {
        assessmentId: assessment.id,
        organizationId: exam.organizationId,
        version: '1.0.0',
        status: 'PUBLISHED',
        title: exam.title,
        description: exam.description,
        blueprintJson,
        contentHash: hash(blueprintJson),
        publishedAt: exam.updatedAt || exam.createdAt,
        createdByUserId: exam.createdBy,
        approvedByUserId: exam.createdBy,
      },
    });
    assessmentVersionCount++;

    for (const examQuestion of exam.examQuestions) {
      const question = await prisma.question.findUnique({
        where: { id: examQuestion.questionId },
      });
      if (!question) continue;

      const content = question.contentJsonb as any;
      const dimension = content?.dimension || 'GENERAL';

      const category = await (prisma as any).psychometricCategory.upsert({
        where: {
          organizationId_code: {
            organizationId: exam.organizationId,
            code: dimension,
          },
        },
        update: {},
        create: {
          organizationId: exam.organizationId,
          code: dimension,
          name: dimension,
          description: 'Categoría creada por backfill desde preguntas legacy.',
        },
      });

      const item = await (prisma as any).item.upsert({
        where: {
          organizationId_itemCode: {
            organizationId: exam.organizationId,
            itemCode: `QUESTION_${question.id}`,
          },
        },
        update: {},
        create: {
          organizationId: exam.organizationId,
          itemCode: `QUESTION_${question.id}`,
          categoryId: category.id,
          status: 'ACTIVE',
        },
      });
      itemCount++;

      const stemJson = {
        legacyQuestionId: question.id,
        type: question.type,
        content: stripCorrectConfig(content),
        defaultPoints: Number(question.defaultPoints),
      };

      const scoringKeyJson = extractScoringKey(content);
      const itemVersion = await (prisma as any).itemVersion.upsert({
        where: {
          itemId_version: {
            itemId: item.id,
            version: '1.0.0',
          },
        },
        update: {},
        create: {
          itemId: item.id,
          version: '1.0.0',
          status: 'ACTIVE',
          language: 'es',
          stemJson,
          scoringKeyJson: scoringKeyJson || undefined,
          tags: { migratedFrom: 'Question', dimension },
          expectedTimeSeconds: null,
          contentHash: hash({ stemJson, scoringKeyJson }),
          publishedAt: question.updatedAt || question.createdAt,
        },
      });
      itemVersionCount++;

      await (prisma as any).assessmentVersionItem.upsert({
        where: {
          assessmentVersionId_itemVersionId: {
            assessmentVersionId: assessmentVersion.id,
            itemVersionId: itemVersion.id,
          },
        },
        update: {},
        create: {
          assessmentVersionId: assessmentVersion.id,
          itemVersionId: itemVersion.id,
          sortOrder: examQuestion.sortOrder,
          weight: examQuestion.points,
          role: 'SCORED',
        },
      });
      linkCount++;
    }

    await ensureLegacyGovernanceArtifacts(exam, assessmentVersion.id);
  }

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        exams: exams.length,
        assessmentsTouched: assessmentCount,
        assessmentVersionsTouched: assessmentVersionCount,
        itemsTouched: itemCount,
        itemVersionsTouched: itemVersionCount,
        assessmentVersionItemsTouched: linkCount,
      },
      null,
      2,
    ),
  );
}

async function ensureLegacyGovernanceArtifacts(exam: any, assessmentVersionId: string) {
  const scoringModel = await (prisma as any).scoringModel.upsert({
    where: {
      organizationId_code: {
        organizationId: exam.organizationId,
        code: `SCORING_${exam.id}`,
      },
    },
    update: {},
    create: {
      organizationId: exam.organizationId,
      assessmentVersionId,
      code: `SCORING_${exam.id}`,
      name: `Scoring legacy actual - ${exam.title}`,
      modelType: 'LEGACY_CURRENT',
      description: 'Modelo de scoring existente registrado para trazabilidad; no cambia algoritmos.',
    },
  });

  await (prisma as any).scoringModelVersion.upsert({
    where: {
      scoringModelId_version: {
        scoringModelId: scoringModel.id,
        version: 'legacy-current',
      },
    },
    update: {},
    create: {
      scoringModelId: scoringModel.id,
      version: 'legacy-current',
      status: 'PUBLISHED',
      algorithmKey: 'legacy-current-calculator',
      parametersJson: { source: 'existing-calculators', migratedFrom: 'Fase 4.1 backfill' },
      contentHash: hash({ algorithmKey: 'legacy-current-calculator', examId: exam.id }),
      effectiveFrom: exam.updatedAt || exam.createdAt,
    },
  });

  const normGroup = await (prisma as any).normGroup.upsert({
    where: {
      organizationId_code: {
        organizationId: exam.organizationId,
        code: `NORM_${exam.id}`,
      },
    },
    update: {},
    create: {
      organizationId: exam.organizationId,
      assessmentVersionId,
      code: `NORM_${exam.id}`,
      name: `Baremo legacy actual - ${exam.title}`,
      description: 'Grupo normativo placeholder para trazabilidad; no recalibra baremos.',
      populationJson: { source: 'legacy-current', scope: 'unversioned-existing-norms' },
    },
  });

  await (prisma as any).normGroupVersion.upsert({
    where: {
      normGroupId_version: {
        normGroupId: normGroup.id,
        version: 'legacy-current',
      },
    },
    update: {},
    create: {
      normGroupId: normGroup.id,
      version: 'legacy-current',
      status: 'PUBLISHED',
      populationJson: { source: 'legacy-current' },
      normTableJson: { source: 'existing-baremos-and-dynamic-norms' },
      contentHash: hash({ normGroupId: normGroup.id, examId: exam.id }),
      effectiveFrom: exam.updatedAt || exam.createdAt,
    },
  });

  const reportTemplate = await (prisma as any).reportTemplate.upsert({
    where: {
      organizationId_code: {
        organizationId: exam.organizationId,
        code: `REPORT_${exam.id}`,
      },
    },
    update: {},
    create: {
      organizationId: exam.organizationId,
      assessmentVersionId,
      code: `REPORT_${exam.id}`,
      name: `Reporte legacy actual - ${exam.title}`,
      audience: 'STAFF',
      description: 'Plantilla lógica del reporte actual registrada para trazabilidad; no genera PDF.',
    },
  });

  await (prisma as any).reportTemplateVersion.upsert({
    where: {
      reportTemplateId_version: {
        reportTemplateId: reportTemplate.id,
        version: 'legacy-current',
      },
    },
    update: {},
    create: {
      reportTemplateId: reportTemplate.id,
      version: 'legacy-current',
      status: 'PUBLISHED',
      templateJson: { source: 'current-report-service-response' },
      interpretationRulesJson: { source: 'current-inline-report-rules' },
      contentHash: hash({ reportTemplateId: reportTemplate.id, examId: exam.id }),
      effectiveFrom: exam.updatedAt || exam.createdAt,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
