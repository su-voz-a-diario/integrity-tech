import { PrismaClient } from '@prisma/client';
import { createHash, pbkdf2Sync, randomBytes } from 'crypto';

const prisma = new PrismaClient();

const PASSWORD = process.env.E2E_STAFF_PASSWORD || 'IntegrityE2E123!';

const IDS = {
  orgA: '00000000-0000-7000-8000-00000000e001',
  orgB: '00000000-0000-7000-8000-00000000e002',
  adminA: '00000000-0000-7000-8000-00000000e101',
  recruiterA: '00000000-0000-7000-8000-00000000e102',
  psychologistA: '00000000-0000-7000-8000-00000000e103',
  evaluatorA: '00000000-0000-7000-8000-00000000e104',
  recruiterB: '00000000-0000-7000-8000-00000000e202',
  adminB: '00000000-0000-7000-8000-00000000e201',
  bankA: '00000000-0000-7000-8000-00000000e301',
  bankB: '00000000-0000-7000-8000-00000000e302',
  questionA1: '00000000-0000-7000-8000-00000000e401',
  questionA2: '00000000-0000-7000-8000-00000000e402',
  questionA3: '00000000-0000-7000-8000-00000000e403',
  questionB1: '00000000-0000-7000-8000-00000000e404',
  examA: '00000000-0000-7000-8000-00000000e501',
  examB: '00000000-0000-7000-8000-00000000e502',
  perfilA: '00000000-0000-7000-8000-00000000e601',
  perfilB: '00000000-0000-7000-8000-00000000e602',
  assessmentA: '00000000-0000-7000-8000-00000000e501',
  assessmentB: '00000000-0000-7000-8000-00000000e502',
  assessmentVersionA: '00000000-0000-7000-8000-00000000e801',
  assessmentVersionB: '00000000-0000-7000-8000-00000000e802',
  itemA1: '00000000-0000-7000-8000-00000000e901',
  itemA2: '00000000-0000-7000-8000-00000000e902',
  itemA3: '00000000-0000-7000-8000-00000000e903',
  itemB1: '00000000-0000-7000-8000-00000000e904',
  itemVersionA1: '00000000-0000-7000-8000-00000000ea01',
  itemVersionA2: '00000000-0000-7000-8000-00000000ea02',
  itemVersionA3: '00000000-0000-7000-8000-00000000ea03',
  itemVersionB1: '00000000-0000-7000-8000-00000000ea04',
  normGroupA: '00000000-0000-7000-8000-00000000eb01',
  normGroupB: '00000000-0000-7000-8000-00000000eb02',
  normVersionA: '00000000-0000-7000-8000-00000000ec01',
  normVersionB: '00000000-0000-7000-8000-00000000ec02',
  scoringModelA: '00000000-0000-7000-8000-00000000ed01',
  scoringModelB: '00000000-0000-7000-8000-00000000ed02',
  scoringVersionA: '00000000-0000-7000-8000-00000000ee01',
  scoringVersionB: '00000000-0000-7000-8000-00000000ee02',
  reportTemplateA: '00000000-0000-7000-8000-00000000ef01',
  reportTemplateB: '00000000-0000-7000-8000-00000000ef02',
  reportVersionA: '00000000-0000-7000-8000-00000000f001',
  reportVersionB: '00000000-0000-7000-8000-00000000f002',
};

const PERMISSIONS = [
  'organization.manage',
  'users.manage',
  'roles.manage',
  'invitations.create',
  'invitations.read',
  'attempts.read',
  'attempts.update',
  'reports.read',
  'psychometrics.read',
  'psychometrics.write',
  'audit.read',
  'admin.manage',
];

function hashPassword(password: string): string {
  const iterations = 310000;
  const salt = randomBytes(16).toString('base64url');
  const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64url');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

function hashPayload(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function ensurePermissions() {
  const permissions = new Map<string, { id: string; code: string }>();
  for (const code of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: `Permiso E2E: ${code}` },
    });
    permissions.set(code, permission);
  }
  return permissions;
}

async function ensureRole(name: string, description: string, permissionCodes: string[], permissions: Map<string, { id: string }>) {
  const role = await prisma.role.upsert({
    where: { name },
    update: { description },
    create: { name, description },
  });

  for (const code of permissionCodes) {
    const permission = permissions.get(code);
    if (!permission) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }

  return role;
}

async function ensureUser(input: {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
}) {
  const user = await prisma.user.upsert({
    where: { unique_email_per_org: { organizationId: input.organizationId, email: input.email } },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      isActive: true,
      passwordHash: hashPassword(PASSWORD),
    },
    create: {
      id: input.id,
      organizationId: input.organizationId,
      email: input.email,
      passwordHash: hashPassword(PASSWORD),
      firstName: input.firstName,
      lastName: input.lastName,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: input.roleId } },
    update: {},
    create: { userId: user.id, roleId: input.roleId },
  });

  return user;
}

async function ensureOrganization(id: string, slug: string, name: string) {
  return prisma.organization.upsert({
    where: { slug },
    update: { name, isActive: true },
    create: { id, slug, name, isActive: true },
  });
}

async function ensureAssessmentDeliveryData(input: {
  organizationId: string;
  adminId: string;
  examId: string;
  perfilId: string;
  title: string;
}) {
  const exam = await prisma.exam.upsert({
    where: { id: input.examId },
    update: {
      organizationId: input.organizationId,
      title: input.title,
      durationMinutes: 20,
      isPublished: true,
      createdBy: input.adminId,
    },
    create: {
      id: input.examId,
      organizationId: input.organizationId,
      title: input.title,
      description: 'Evaluación E2E publicada para flujo completo.',
      durationMinutes: 20,
      isPublished: true,
      createdBy: input.adminId,
    },
  });


  await prisma.perfilPuesto.upsert({
    where: { id: input.perfilId },
    update: { organizationId: input.organizationId, nombre: 'Perfil E2E General' },
    create: {
      id: input.perfilId,
      organizationId: input.organizationId,
      nombre: 'Perfil E2E General',
      wIntegridad: 0.4,
      wPersonalidad: 0.2,
      wCognitivo: 0.2,
      wCompetencias: 0.2,
    },
  });

  return exam;
}

async function ensurePsychometricGovernance(input: {
  organizationId: string;
  adminId: string;
  examId: string;
  assessmentVersionId: string;
  questions: Array<{ id: string; type: string; points: number; content: any; itemId: string; itemVersionId: string }>;
  normGroupId: string;
  normVersionId: string;
  scoringModelId: string;
  scoringVersionId: string;
  reportTemplateId: string;
  reportVersionId: string;
  title: string;
}) {
  const assessmentCode = input.examId;
  const assessment = await (prisma as any).assessment.upsert({
    where: { id: input.examId },
    update: {
      organizationId: input.organizationId,
      code: assessmentCode,
      name: input.title,
      description: 'Assessment gobernado para E2E.',
      status: 'PUBLISHED',
      createdByUserId: input.adminId,
    },
    create: {
      id: input.examId,
      organizationId: input.organizationId,
      code: assessmentCode,
      name: input.title,
      description: 'Assessment gobernado para E2E.',
      status: 'PUBLISHED',
      createdByUserId: input.adminId,
    },
  });

  const assessmentVersion = await (prisma as any).assessmentVersion.upsert({
    where: { id: input.assessmentVersionId },
    update: {
      assessmentId: assessment.id,
      organizationId: input.organizationId,
      status: 'PUBLISHED',
      title: input.title,
      description: 'Versión publicada para pruebas E2E.',
      blueprintJson: { source: 'seed-e2e', assessmentId: assessment.id, itemCount: input.questions.length },
      contentHash: hashPayload({ assessmentId: assessment.id, version: 'e2e-v1' }),
      publishedAt: new Date(),
      createdByUserId: input.adminId,
      approvedByUserId: input.adminId,
    },
    create: {
      id: input.assessmentVersionId,
      assessmentId: assessment.id,
      organizationId: input.organizationId,
      version: 'e2e-v1',
      status: 'PUBLISHED',
      title: input.title,
      description: 'Versión publicada para pruebas E2E.',
      blueprintJson: { source: 'seed-e2e', assessmentId: assessment.id, itemCount: input.questions.length },
      contentHash: hashPayload({ assessmentId: assessment.id, version: 'e2e-v1' }),
      publishedAt: new Date(),
      createdByUserId: input.adminId,
      approvedByUserId: input.adminId,
    },
  });

  for (const [index, question] of input.questions.entries()) {
    const itemCode = question.itemId;
    const item = await (prisma as any).item.findUnique({
      where: { organizationId_itemCode: { organizationId: input.organizationId, itemCode } },
    }) || await (prisma as any).item.create({
      data: {
        id: question.itemId,
        organizationId: input.organizationId,
        itemCode,
        status: 'ACTIVE',
        createdByUserId: input.adminId,
      },
    });

    const stem = {
      type: question.type,
      defaultPoints: question.points,
      content: question.content,
    };
    const itemVersion = await (prisma as any).itemVersion.findUnique({
      where: { itemId_version: { itemId: item.id, version: 'e2e-v1' } },
    }) || await (prisma as any).itemVersion.create({
      data: {
        id: question.itemVersionId,
        itemId: item.id,
        version: 'e2e-v1',
        status: 'PUBLISHED',
        language: 'es',
        stemJson: stem,
        scoringKeyJson: question.content.correctConfig || null,
        tags: ['e2e', 'enterprise'],
        difficulty: 0,
        discrimination: 1,
        expectedTimeSeconds: 45,
        contentHash: hashPayload(stem),
        publishedAt: new Date(),
        createdByUserId: input.adminId,
        approvedByUserId: input.adminId,
      },
    });

    await (prisma as any).assessmentVersionItem.upsert({
      where: {
        assessmentVersionId_itemVersionId: {
          assessmentVersionId: assessmentVersion.id,
          itemVersionId: itemVersion.id,
        },
      },
      update: { sortOrder: index, weight: question.points },
      create: {
        assessmentVersionId: assessmentVersion.id,
        itemVersionId: itemVersion.id,
        sortOrder: index,
        weight: question.points,
      },
    });
  }

  const normGroup = await (prisma as any).normGroup.findUnique({
    where: { organizationId_code: { organizationId: input.organizationId, code: `NORM_${input.examId}` } },
  }) || await (prisma as any).normGroup.create({
    data: {
      id: input.normGroupId,
      organizationId: input.organizationId,
      assessmentVersionId: assessmentVersion.id,
      code: `NORM_${input.examId}`,
      name: 'Norma E2E',
      populationJson: { country: 'MX', sample: 'e2e' },
    },
  });

  await (prisma as any).normGroupVersion.findUnique({
    where: { normGroupId_version: { normGroupId: normGroup.id, version: 'e2e-v1' } },
  }) || await (prisma as any).normGroupVersion.create({
    data: {
      id: input.normVersionId,
      normGroupId: normGroup.id,
      version: 'e2e-v1',
      status: 'PUBLISHED',
      populationJson: { country: 'MX', sample: 'e2e' },
      normTableJson: { percentiles: [{ raw: 0, percentile: 1 }, { raw: 3, percentile: 80 }] },
      sampleSize: 100,
      effectiveFrom: new Date(),
      contentHash: hashPayload({ norm: input.examId }),
      createdByUserId: input.adminId,
      approvedByUserId: input.adminId,
    },
  });

  const scoringModel = await (prisma as any).scoringModel.findUnique({
    where: { organizationId_code: { organizationId: input.organizationId, code: `SCORING_${input.examId}` } },
  }) || await (prisma as any).scoringModel.create({
    data: {
      id: input.scoringModelId,
      organizationId: input.organizationId,
      assessmentVersionId: assessmentVersion.id,
      code: `SCORING_${input.examId}`,
      name: 'Scoring E2E',
      modelType: 'ASSESSMENT_VERSION_SCORING',
    },
  });

  await (prisma as any).scoringModelVersion.findUnique({
    where: { scoringModelId_version: { scoringModelId: scoringModel.id, version: 'e2e-v1' } },
  }) || await (prisma as any).scoringModelVersion.create({
    data: {
      id: input.scoringVersionId,
      scoringModelId: scoringModel.id,
      version: 'e2e-v1',
      status: 'PUBLISHED',
      algorithmKey: 'assessment-version-e2e',
      parametersJson: { mode: 'e2e' },
      contentHash: hashPayload({ scoring: input.examId }),
      effectiveFrom: new Date(),
      createdByUserId: input.adminId,
      approvedByUserId: input.adminId,
    },
  });

  const reportTemplate = await (prisma as any).reportTemplate.findUnique({
    where: { organizationId_code: { organizationId: input.organizationId, code: `REPORT_${input.examId}` } },
  }) || await (prisma as any).reportTemplate.create({
    data: {
      id: input.reportTemplateId,
      organizationId: input.organizationId,
      assessmentVersionId: assessmentVersion.id,
      code: `REPORT_${input.examId}`,
      name: 'Reporte E2E',
      audience: 'STAFF',
    },
  });

  await (prisma as any).reportTemplateVersion.findUnique({
    where: { reportTemplateId_version: { reportTemplateId: reportTemplate.id, version: 'e2e-v1' } },
  }) || await (prisma as any).reportTemplateVersion.create({
    data: {
      id: input.reportVersionId,
      reportTemplateId: reportTemplate.id,
      version: 'e2e-v1',
      status: 'PUBLISHED',
      templateJson: { sections: ['summary', 'dimensions', 'proctoring'] },
      interpretationRulesJson: { mode: 'e2e' },
      contentHash: hashPayload({ report: input.examId }),
      effectiveFrom: new Date(),
      createdByUserId: input.adminId,
      approvedByUserId: input.adminId,
    },
  });
}

async function main() {
  const permissions = await ensurePermissions();
  const adminRole = await ensureRole('admin', 'Administrador E2E con acceso completo.', PERMISSIONS, permissions);
  const recruiterRole = await ensureRole(
    'recruiter',
    'Reclutador E2E.',
    ['invitations.create', 'invitations.read', 'attempts.read', 'reports.read'],
    permissions,
  );
  const psychologistRole = await ensureRole(
    'psychologist',
    'Psicóloga E2E.',
    ['attempts.read', 'reports.read', 'psychometrics.read', 'psychometrics.write'],
    permissions,
  );
  const evaluatorRole = await ensureRole(
    'evaluator',
    'Evaluador E2E.',
    ['attempts.read', 'reports.read', 'psychometrics.read'],
    permissions,
  );

  const orgA = await ensureOrganization(IDS.orgA, 'e2e-org-a', 'E2E Organization A');
  const orgB = await ensureOrganization(IDS.orgB, 'e2e-org-b', 'E2E Organization B');

  await ensureUser({ id: IDS.adminA, organizationId: orgA.id, email: 'admin-a@e2e.integrity.test', firstName: 'Admin', lastName: 'A', roleId: adminRole.id });
  await ensureUser({ id: IDS.recruiterA, organizationId: orgA.id, email: 'recruiter-a@e2e.integrity.test', firstName: 'Recruiter', lastName: 'A', roleId: recruiterRole.id });
  await ensureUser({ id: IDS.psychologistA, organizationId: orgA.id, email: 'psychologist-a@e2e.integrity.test', firstName: 'Psychologist', lastName: 'A', roleId: psychologistRole.id });
  await ensureUser({ id: IDS.evaluatorA, organizationId: orgA.id, email: 'evaluator-a@e2e.integrity.test', firstName: 'Evaluator', lastName: 'A', roleId: evaluatorRole.id });
  await ensureUser({ id: IDS.adminB, organizationId: orgB.id, email: 'admin-b@e2e.integrity.test', firstName: 'Admin', lastName: 'B', roleId: adminRole.id });
  await ensureUser({ id: IDS.recruiterB, organizationId: orgB.id, email: 'recruiter-b@e2e.integrity.test', firstName: 'Recruiter', lastName: 'B', roleId: recruiterRole.id });

  const questionsA = [
    {
      id: IDS.questionA1,
      itemId: IDS.itemA1,
      itemVersionId: IDS.itemVersionA1,
      type: 'MULTIPLE_CHOICE',
      points: 2,
      content: {
        dimension: 'INTEGRIDAD',
        text: 'Detectas una diferencia menor en caja al cierre. ¿Qué haces?',
        options: [
          { id: 'a', text: 'La ignoro porque es menor.' },
          { id: 'b', text: 'La documento y reporto conforme al procedimiento.' },
          { id: 'c', text: 'La compenso sin avisar.' },
        ],
        correctConfig: { correctOptionId: 'b' },
      },
    },
    {
      id: IDS.questionA2,
      itemId: IDS.itemA2,
      itemVersionId: IDS.itemVersionA2,
      type: 'LIKERT',
      points: 1,
      content: {
        dimension: 'PERSONALIDAD',
        text: 'Respeto políticas internas aunque nadie supervise.',
        scale: { min: 1, max: 5, labels: { '1': 'Totalmente en desacuerdo', '5': 'Totalmente de acuerdo' } },
        correctConfig: { weights: { '1': 0, '2': 0.25, '3': 0.5, '4': 0.75, '5': 1 } },
      },
    },
    {
      id: IDS.questionA3,
      itemId: IDS.itemA3,
      itemVersionId: IDS.itemVersionA3,
      type: 'MULTIPLE_CHOICE',
      points: 1,
      content: {
        dimension: 'COGNITIVO',
        text: '¿Qué número continúa la serie 3, 6, 12, 24?',
        options: [
          { id: 'a', text: '36' },
          { id: 'b', text: '42' },
          { id: 'c', text: '48' },
        ],
        correctConfig: { correctOptionId: 'c' },
      },
    },
  ];

  const questionsB = [
    {
      id: IDS.questionB1,
      itemId: IDS.itemB1,
      itemVersionId: IDS.itemVersionB1,
      type: 'MULTIPLE_CHOICE',
      points: 1,
      content: {
        dimension: 'INTEGRIDAD',
        text: 'Pregunta aislada de tenant B.',
        options: [
          { id: 'a', text: 'Incorrecta' },
          { id: 'b', text: 'Correcta' },
        ],
        correctConfig: { correctOptionId: 'b' },
      },
    },
  ];

  await ensureAssessmentDeliveryData({
    organizationId: orgA.id,
    adminId: IDS.adminA,
    examId: IDS.examA,
    perfilId: IDS.perfilA,
    title: 'Evaluación E2E Enterprise A',
  });
  await ensureAssessmentDeliveryData({
    organizationId: orgB.id,
    adminId: IDS.adminB,
    examId: IDS.examB,
    perfilId: IDS.perfilB,
    title: 'Evaluación E2E Enterprise B',
  });

  await ensurePsychometricGovernance({
    organizationId: orgA.id,
    adminId: IDS.adminA,
    examId: IDS.examA,
    assessmentVersionId: IDS.assessmentVersionA,
    questions: questionsA,
    normGroupId: IDS.normGroupA,
    normVersionId: IDS.normVersionA,
    scoringModelId: IDS.scoringModelA,
    scoringVersionId: IDS.scoringVersionA,
    reportTemplateId: IDS.reportTemplateA,
    reportVersionId: IDS.reportVersionA,
    title: 'Evaluación E2E Enterprise A',
  });
  await ensurePsychometricGovernance({
    organizationId: orgB.id,
    adminId: IDS.adminB,
    examId: IDS.examB,
    assessmentVersionId: IDS.assessmentVersionB,
    questions: questionsB,
    normGroupId: IDS.normGroupB,
    normVersionId: IDS.normVersionB,
    scoringModelId: IDS.scoringModelB,
    scoringVersionId: IDS.scoringVersionB,
    reportTemplateId: IDS.reportTemplateB,
    reportVersionId: IDS.reportVersionB,
    title: 'Evaluación E2E Enterprise B',
  });

  await prisma.candidateInvitation.upsert({
    where: { accessCode: 'IT-900001' },
    update: {
      organizationId: orgA.id,
      createdByUserId: IDS.recruiterA,
      examId: IDS.examA,
      email: 'seeded-candidate@e2e.integrity.test',
      candidateName: 'Seeded Candidate',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      attemptId: null,
    },
    create: {
      organizationId: orgA.id,
      createdByUserId: IDS.recruiterA,
      examId: IDS.examA,
      email: 'seeded-candidate@e2e.integrity.test',
      candidateName: 'Seeded Candidate',
      accessCode: 'IT-900001',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  console.log(JSON.stringify({
    status: 'ok',
    password: PASSWORD,
    orgA: orgA.slug,
    orgB: orgB.slug,
    examA: IDS.examA,
    examB: IDS.examB,
    users: {
      adminA: 'admin-a@e2e.integrity.test',
      recruiterA: 'recruiter-a@e2e.integrity.test',
      psychologistA: 'psychologist-a@e2e.integrity.test',
      evaluatorA: 'evaluator-a@e2e.integrity.test',
      recruiterB: 'recruiter-b@e2e.integrity.test',
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
