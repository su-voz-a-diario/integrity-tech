import { PrismaClient } from '@prisma/client';
import { pbkdf2Sync, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const iterations = 310000;
  const salt = randomBytes(16).toString('base64url');
  const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64url');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: 'integrity-demo' },
    update: {},
    create: {
      name: 'Integrity Demo',
      slug: 'integrity-demo',
    },
  });

  const permissions = await Promise.all(
    [
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
      'exam:create',
      'exam:attempt',
    ].map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: {
          code,
          description: `Permiso demo: ${code}`,
        },
      }),
    ),
  );

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrador demo con acceso completo.',
    },
  });

  const recruiterRole = await prisma.role.upsert({
    where: { name: 'recruiter' },
    update: {},
    create: {
      name: 'recruiter',
      description: 'Reclutador demo para invitaciones y reportes.',
    },
  });

  const psychologistRole = await prisma.role.upsert({
    where: { name: 'psychologist' },
    update: {},
    create: {
      name: 'psychologist',
      description: 'Psicóloga demo para consulta psicométrica.',
    },
  });

  const evaluatorRole = await prisma.role.upsert({
    where: { name: 'evaluator' },
    update: {},
    create: {
      name: 'evaluator',
      description: 'Evaluador demo para revisión de resultados.',
    },
  });

  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  for (const code of ['invitations.create', 'invitations.read', 'attempts.read', 'reports.read']) {
    const permission = permissions.find((p) => p.code === code)!;
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: recruiterRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: recruiterRole.id,
        permissionId: permission.id,
      },
    });
  }

  for (const role of [psychologistRole, evaluatorRole]) {
    for (const code of ['attempts.read', 'reports.read', 'psychometrics.read']) {
      const permission = permissions.find((p) => p.code === code)!;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  const demoPassword = process.env.DEMO_STAFF_PASSWORD || 'IntegrityDemo123!';
  const demoPasswordHash = hashPassword(demoPassword);

  const admin = await prisma.user.upsert({
    where: {
      unique_email_per_org: {
        organizationId: organization.id,
        email: 'admin@integrity.demo',
      },
    },
    update: {
      firstName: 'Admin',
      lastName: 'Demo',
      isActive: true,
      passwordHash: demoPasswordHash,
    },
    create: {
      organizationId: organization.id,
      email: 'admin@integrity.demo',
      passwordHash: demoPasswordHash,
      firstName: 'Admin',
      lastName: 'Demo',
    },
  });

  const recruiter = await prisma.user.upsert({
    where: {
      unique_email_per_org: {
        organizationId: organization.id,
        email: 'recruiter@integrity.demo',
      },
    },
    update: {
      firstName: 'Recruiter',
      lastName: 'Demo',
      isActive: true,
      passwordHash: demoPasswordHash,
    },
    create: {
      organizationId: organization.id,
      email: 'recruiter@integrity.demo',
      passwordHash: demoPasswordHash,
      firstName: 'Recruiter',
      lastName: 'Demo',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: recruiter.id,
        roleId: recruiterRole.id,
      },
    },
    update: {},
    create: {
      userId: recruiter.id,
      roleId: recruiterRole.id,
    },
  });

  const questionBank = await prisma.questionBank.upsert({
    where: { id: '00000000-0000-7000-8000-000000000101' },
    update: {
      organizationId: organization.id,
      name: 'Banco Demo Integrity Test',
      createdBy: admin.id,
    },
    create: {
      id: '00000000-0000-7000-8000-000000000101',
      organizationId: organization.id,
      name: 'Banco Demo Integrity Test',
      description: 'Reactivos mínimos para probar el flujo real candidato-reclutador.',
      createdBy: admin.id,
    },
  });

  const demoQuestions = [
    {
      id: '00000000-0000-7000-8000-000000000201',
      type: 'MULTIPLE_CHOICE',
      defaultPoints: 2,
      contentJsonb: {
        dimension: 'INTEGRIDAD',
        text: 'Encuentras un sobrante de caja al finalizar tu turno. ¿Qué haces?',
        options: [
          { id: 'a', text: 'Lo tomo porque nadie lo notará.' },
          { id: 'b', text: 'Lo reporto y documento el cierre.' },
          { id: 'c', text: 'Lo dejo sin avisar.' },
          { id: 'd', text: 'Lo comparto con el equipo.' },
        ],
        correctConfig: { correctOptionId: 'b' },
      },
    },
    {
      id: '00000000-0000-7000-8000-000000000202',
      type: 'LIKERT',
      defaultPoints: 1,
      contentJsonb: {
        dimension: 'PERSONALIDAD',
        text: 'Cumplo los procedimientos incluso cuando nadie supervisa.',
        scale: {
          min: 1,
          max: 5,
          labels: {
            '1': 'Totalmente en desacuerdo',
            '5': 'Totalmente de acuerdo',
          },
        },
        correctConfig: {
          weights: { '1': 0, '2': 0.25, '3': 0.5, '4': 0.75, '5': 1 },
        },
      },
    },
    {
      id: '00000000-0000-7000-8000-000000000203',
      type: 'MULTIPLE_CHOICE',
      defaultPoints: 1,
      contentJsonb: {
        dimension: 'COGNITIVO',
        text: '¿Qué número continúa la serie 2, 4, 8, 16?',
        options: [
          { id: 'a', text: '20' },
          { id: 'b', text: '24' },
          { id: 'c', text: '32' },
          { id: 'd', text: '36' },
        ],
        correctConfig: { correctOptionId: 'c' },
      },
    },
  ];

  for (const question of demoQuestions) {
    await prisma.question.upsert({
      where: { id: question.id },
      update: {
        questionBankId: questionBank.id,
        type: question.type,
        contentJsonb: question.contentJsonb,
        defaultPoints: question.defaultPoints,
      },
      create: {
        id: question.id,
        questionBankId: questionBank.id,
        type: question.type,
        contentJsonb: question.contentJsonb,
        defaultPoints: question.defaultPoints,
      },
    });
  }

  const exam = await prisma.exam.upsert({
    where: { id: '00000000-0000-7000-8000-000000000301' },
    update: {
      organizationId: organization.id,
      title: 'Evaluación Demo Integrity Test',
      isPublished: true,
      createdBy: admin.id,
      durationMinutes: 30,
    },
    create: {
      id: '00000000-0000-7000-8000-000000000301',
      organizationId: organization.id,
      title: 'Evaluación Demo Integrity Test',
      description: 'Examen mínimo publicado para pruebas end-to-end.',
      durationMinutes: 30,
      isPublished: true,
      createdBy: admin.id,
    },
  });

  for (const [index, question] of demoQuestions.entries()) {
    await prisma.examQuestion.upsert({
      where: {
        unique_question_per_exam: {
          examId: exam.id,
          questionId: question.id,
        },
      },
      update: {
        points: question.defaultPoints,
        sortOrder: index,
      },
      create: {
        examId: exam.id,
        questionId: question.id,
        points: question.defaultPoints,
        sortOrder: index,
      },
    });
  }

  await prisma.perfilPuesto.upsert({
    where: { id: '00000000-0000-7000-8000-000000000401' },
    update: {
      organizationId: organization.id,
    },
    create: {
      id: '00000000-0000-7000-8000-000000000401',
      organizationId: organization.id,
      nombre: 'Perfil Demo General',
      wIntegridad: 0.4,
      wPersonalidad: 0.2,
      wCognitivo: 0.2,
      wCompetencias: 0.2,
    },
  });

  console.log('Seed demo completado.');
  console.log('Organizacion:', organization.slug);
  console.log('Admin demo:', admin.email);
  console.log('Recruiter demo:', recruiter.email);
  console.log('Examen demo:', exam.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
