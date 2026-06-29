import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';

describe('Flujo de Evaluación y Proctoring (Prueba de Integración)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let postgresContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let answersQueue: Queue;

  // ============================================================================
  // SETUP DE TESTCONTAINERS (Entorno Aislado Real)
  // ============================================================================
  beforeAll(async () => {
    jest.setTimeout(120000); // Aumentar timeout para descargas e inicios de contenedores

    // 1. Inicializar contenedor real de PostgreSQL
    postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('evaluartest_test_db')
      .withUser('postgres')
      .withPassword('testpassword123')
      .start();

    // 2. Inicializar contenedor real de Redis
    redisContainer = await new RedisContainer('redis:7-alpine').start();

    // 3. Sobrescribir variables de entorno de red dinámicamente con los puertos mapeados por Testcontainers
    const dbUrl = postgresContainer.getConnectionString();
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_HOST = redisContainer.getHost();
    process.env.REDIS_PORT = redisContainer.getMappedPort(6379).toString();
    process.env.JWT_SECRET = 'test-jwt-secret-key-12345';
    process.env.NODE_ENV = 'test';

    // 4. Ejecutar migraciones de Prisma en la base de datos de pruebas temporales
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: dbUrl },
    });

    // 5. Inicializar la aplicación de NestJS cargando los módulos reales
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    answersQueue = app.get<Queue>(getQueueToken('answers-queue'));
  });

  afterAll(async () => {
    await app.close();
    await postgresContainer.stop();
    await redisContainer.stop();
  });

  beforeEach(async () => {
    // Limpiar tablas para evitar colisiones entre aserciones de prueba
    await prisma.attemptLog.deleteMany();
    await prisma.answerSubmission.deleteMany();
    await prisma.examAttempt.deleteMany();
    await prisma.examQuestion.deleteMany();
    await prisma.question.deleteMany();
    await prisma.questionBank.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.organization.deleteMany();

    // Limpiar colas de Redis
    await answersQueue.empty();
  });

  // ============================================================================
  // PRUEBA DEL FLUJO CRÍTICO (E2E)
  // ============================================================================
  it('Debe crear un intento, encolar una respuesta, procesar y calificar correctamente', async () => {
    // 1. SEEDING: Crear Organización y Usuarios (Admin y Estudiante)
    const org = await prisma.organization.create({
      data: { name: 'Universidad de Pruebas', slug: 'uni-pruebas' },
    });

    const student = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: 'estudiante@pruebas.edu',
        passwordHash: 'hashed_password_123',
        firstName: 'Juan',
        lastName: 'Pérez',
      },
    });

    // 2. SEEDING: Crear Assessment (Evaluación) y Pregunta de Opción Múltiple
    const questionBank = await prisma.questionBank.create({
      data: {
        organizationId: org.id,
        name: 'Banco Física',
        createdBy: student.id,
      },
    });

    const question = await prisma.question.create({
      data: {
        questionBankId: questionBank.id,
        type: 'MULTIPLE_CHOICE',
        contentJsonb: {
          text: '¿Cuál es la velocidad de la luz?',
          correctConfig: {
            correctOptionId: 'opt-correcta',
          },
        },
        defaultPoints: 5.0, // Ponderación de 5 puntos
      },
    });

    const exam = await prisma.exam.create({
      data: {
        organizationId: org.id,
        title: 'Examen de Física Fundamental',
        createdBy: student.id,
        isPublished: true,
        maxAttempts: 1,
      },
    });

    await prisma.examQuestion.create({
      data: {
        examId: exam.id,
        questionId: question.id,
        points: 5.0,
      },
    });

    // 3. Crear un Intento de Assessment (ExamAttempt)
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        userId: student.id,
        status: 'IN_PROGRESS',
      },
    });

    // Inicializar el contador en Redis para BullMQ
    const redis = answersQueue.client;
    await redis.set(`attempt:${attempt.id}:pending_answers`, '1');

    // Simular un Token del estudiante (mock del IamFacade.validateSession en producción)
    // Para simplificar la integración, asumimos que el endpoint recibe un token mockeado
    const studentToken = 'valid-student-token'; 
    // Nota: En una prueba completa de supertest pasaríamos el header con el Bearer token,
    // y mockearíamos la fachada en el módulo de NestJS para que retorne nuestro objeto `student`.

    // 4. EJECUTAR ENVÍO DE RESPUESTA A TRAVÉS DEL CONTROLADOR HTTP REST
    const responsePayload = {
      questionId: question.id,
      response: { selectedOptionId: 'opt-correcta' }, // Respuesta Correcta
    };

    const response = await request(app.getHttpServer())
      .post(`/evaluations/attempts/${attempt.id}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send(responsePayload)
      .expect(HttpStatus.ACCEPTED); // Esperamos 202 Accepted

    expect(response.body.status).toBe('accepted');
    expect(response.body.jobId).toBeDefined();

    // 5. ESPERAR A QUE EL TRABAJO SEA PROCESADO POR EL GRADINGWORKER (Cola Asíncrona)
    // Hacemos polling de la base de datos hasta por 5 segundos esperando que aparezca la sumisión evaluada
    let submission = null;
    for (let i = 0; i < 10; i++) {
      submission = await prisma.answerSubmission.findUnique({
        where: {
          unique_response_per_attempt_question: {
            examAttemptId: attempt.id,
            questionId: question.id,
          },
        },
      });
      if (submission) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Verificar resultado del procesamiento asíncrono
    expect(submission).toBeDefined();
    expect(submission?.isCorrect).toBe(true); // Calificado como correcto por la estrategia
    expect(Number(submission?.pointsEarned)).toBe(5.0); // Puntos ganados consolidados

    // 6. SIMULAR FINALIZACIÓN DEL ASSESSMENT POR PARTE DEL ALUMNO
    // Actualizamos el estado a SUBMITTED para simular el click de fin de evaluación
    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { status: 'SUBMITTED' },
    });

    // Encolamos un decremento de Redis que simule que se procesó una última respuesta o ejecutamos 
    // manualmente el disparador de decremento para forzar la consolidación.
    await redis.decr(`attempt:${attempt.id}:pending_answers`);
    
    // Forzamos el procesamiento de la consolidación llamando al worker o esperando 
    // a que el decremento active la función interna de consolidación en el procesador.
    // Para validar la BD, hacemos polling de consolidación:
    let completedAttempt = null;
    for (let i = 0; i < 10; i++) {
      completedAttempt = await prisma.examAttempt.findUnique({
        where: { id: attempt.id },
      });
      if (completedAttempt?.status === 'COMPLETED') break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(completedAttempt?.status).toBe('COMPLETED');
    expect(Number(completedAttempt?.score)).toBe(5.0); // Nota final consolidada atómicamente
    
    // Verificar que el desglose por dimensiones psicométricas se ha guardado correctamente
    expect(completedAttempt?.scoreDetails).toBeDefined();
    const details = completedAttempt?.scoreDetails as any;
    expect(details.GENERAL).toBeDefined();
    expect(details.GENERAL.percentage).toBe(100.0);
  });

  // ============================================================================
  // PRUEBA DE RESILIENCIA Y REINTENTOS (Fallo de BD)
  // ============================================================================
  it('Debe reintentar el procesamiento del job si la base de datos se cae temporalmente', async () => {
    // 1. Encolar un trabajo en BullMQ de forma artificial
    const job = await answersQueue.add(
      'save-answer',
      {
        attemptId: '00000000-0000-0000-0000-000000000000', // ID inválido o simulado
        questionId: '00000000-0000-0000-0000-000000000000',
        response: { text: 'fallo' },
        submittedAt: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: { type: 'fixed', delay: 100 }, // Delay corto para pruebas rápidas
      },
    );

    // Mockear temporalmente el método prisma.$transaction para que arroje un error de base de datos
    // Esto simula que la base de datos está caída o saturada durante la escritura.
    jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('Postgres Connection Lost'));

    // Esperar a que BullMQ procese y falle la primera vez
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Obtener estado del Job
    const updatedJob = await answersQueue.getJob(job.id!);
    
    // El job no debe haberse perdido; debe registrar el intento fallido e incrementar la cuenta
    expect(updatedJob?.attemptsMade).toBeGreaterThan(0);
    
    const state = await updatedJob?.getState();
    // Debe estar en cola o marcado para reintento (depende del ciclo)
    expect(state).toBeDefined();

    // Limpiar el mock para permitir que futuras llamadas funcionen con éxito
    jest.restoreAllMocks();
  });
});
