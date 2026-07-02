import { 
  Controller, 
  Post, 
  Get,
  Param, 
  Body, 
  UseGuards, 
  HttpCode, 
  HttpStatus, 
  Logger,
  ParseUUIDPipe,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Req
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { AttemptOwnerGuard } from '../guards/attempt-owner.guard';
import { SubmitAnswerBodyDto } from '../dto/submit-answer.dto';
import { SubmitFeedbackDto } from '../dto/submit-feedback.dto';
import { EvaluationQueueProducer } from '../services/evaluation-queue.producer';
import { IgaCalculatorService } from '../services/iga-calculator.service';
import { AnswersQueueProcessor } from '../services/answers-queue.processor';
import { PrismaService } from '../../../shared/database/prisma.service';
import { IamFacade, SessionUser } from '../../iam';
import { randomInt } from 'crypto';

export class RecalcularIgaDto {
  @ApiProperty({ description: 'ID del perfil de puesto a asignar (UUID)', example: 'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', required: false })
  @IsUUID()
  @IsOptional()
  perfilId?: string;
}

export class SubmitSnapshotDto {
  @ApiProperty({ description: 'Imagen capturada de la webcam codificada en Base64', example: 'data:image/jpeg;base64,...' })
  @IsString()
  image: string;
}

export class CreateInvitationDto {
  @ApiProperty({ description: 'Nombre completo del candidato', example: 'Sofía Valenzuela' })
  @IsString()
  candidateName: string;

  @ApiProperty({ description: 'Correo electrónico del candidato', example: 'sofia.valenzuela@example.com' })
  @IsString()
  email: string;

  @ApiProperty({ description: 'ID del examen asignado', example: 'mock-exam-id-1111' })
  @IsString()
  examId: string;
}

export class VerifyAccessCodeDto {
  @ApiProperty({ description: 'Código o llave de acceso de 6 dígitos', example: 'IT-987654' })
  @IsString()
  @Matches(/^IT-\d{6}$/i)
  accessCode: string;
}

export class ClaimAccessCodeDto {
  @ApiProperty({ description: 'Código o llave de acceso de 6 dígitos', example: 'IT-987654' })
  @IsString()
  @Matches(/^IT-\d{6}$/i)
  accessCode: string;

  @ApiProperty({ description: 'Nombre del candidato', example: 'Sofía Valenzuela' })
  @IsString()
  candidateName: string;

  @ApiProperty({ description: 'Correo electrónico del candidato', example: 'sofia.valenzuela@example.com' })
  @IsString()
  email: string;
}

@ApiTags('Evaluations (Motor de Evaluación)')
@ApiBearerAuth()
@Controller('evaluations')
export class EvaluationController {
  private readonly logger = new Logger(EvaluationController.name);

  constructor(
    private readonly queueProducer: EvaluationQueueProducer,
    private readonly prisma: PrismaService,
    private readonly igaCalculator: IgaCalculatorService,
    private readonly iamFacade: IamFacade,
    private readonly answersProcessor: AnswersQueueProcessor,
  ) {}

  /**
   * Generar una clave de acceso única para un candidato.
   * POST /evaluations/invitations
   */
  @ApiOperation({ summary: 'Crear invitación y clave de acceso para un candidato' })
  @ApiResponse({ status: 201, description: 'Invitación creada con éxito.' })
  @Post('invitations')
  @UseGuards(JwtAuthGuard)
  async createInvitation(@Req() req: any, @Body() body: CreateInvitationDto) {
    this.ensureStaffRole(req.user);
    this.logger.log(`Generando clave de acceso para candidato: ${body.candidateName} (${body.email})`);

    const exam = await this.resolveExamForInvitation(body.examId, req.user);
    const accessCode = await this.generateUniqueAccessCode();

    const invitation = await this.prisma.candidateInvitation.create({
      data: {
        examId: exam.id,
        email: body.email.trim().toLowerCase(),
        candidateName: body.candidateName.trim(),
        accessCode,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      }
    });

    return {
      status: 'success',
      accessCode: invitation.accessCode,
      directLink: `/exam/login?code=${invitation.accessCode}`,
    };
  }

  /**
   * Verificar código de acceso del candidato.
   * POST /evaluations/invitations/verify
   */
  @ApiOperation({ summary: 'Verificar la validez de una clave de acceso' })
  @ApiResponse({ status: 200, description: 'Código de acceso válido.' })
  @Post('invitations/verify')
  @HttpCode(HttpStatus.OK)
  async verifyInvitation(@Body() body: VerifyAccessCodeDto) {
    const code = this.normalizeAccessCode(body.accessCode);

    const invitation = await this.prisma.candidateInvitation.findUnique({
      where: { accessCode: code }
    });
    if (!invitation) {
      throw new BadRequestException('El código de acceso especificado no es válido o ha expirado.');
    }

    if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('El código de acceso especificado no es válido o ha expirado.');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Este código de acceso ya ha sido reclamado para una sesión de evaluación.');
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: invitation.examId },
      select: { id: true, title: true },
    });

    return {
      status: 'PENDING',
      candidateName: invitation.candidateName,
      email: invitation.email,
      examId: invitation.examId,
      examTitle: exam?.title || 'Evaluación asignada',
    };
  }

  /**
   * Reclamar/Activar código de acceso e inicializar sesión.
   * POST /evaluations/invitations/claim
   */
  @ApiOperation({ summary: 'Reclamar clave de acceso e iniciar examen' })
  @ApiResponse({ status: 201, description: 'Intento de evaluación iniciado.' })
  @Post('invitations/claim')
  @HttpCode(HttpStatus.CREATED)
  async claimInvitation(@Body() body: ClaimAccessCodeDto) {
    const code = this.normalizeAccessCode(body.accessCode);
    const invitation = await this.prisma.candidateInvitation.findUnique({
      where: { accessCode: code }
    });
    if (!invitation) {
      throw new BadRequestException('Código de acceso no válido.');
    }

    if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('El código de acceso ha expirado.');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('El código ya ha sido reclamado.');
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: invitation.examId },
      select: { id: true, organizationId: true },
    });
    if (!exam) {
      throw new BadRequestException('La evaluación asignada ya no existe.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const nameParts = (body.candidateName || invitation.candidateName || 'Candidato').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Candidato';
      const lastName = nameParts.slice(1).join(' ') || 'Externo';
      const email = (body.email || invitation.email).trim().toLowerCase();

      let candidate = await tx.user.findFirst({
        where: {
          organizationId: exam.organizationId,
          email,
        },
      });

      if (!candidate) {
        candidate = await tx.user.create({
          data: {
            organizationId: exam.organizationId,
            email,
            passwordHash: 'CANDIDATE_INVITATION_NO_PASSWORD',
            firstName,
            lastName,
          },
        });
      }

      const attempt = await tx.examAttempt.create({
        data: {
          examId: invitation.examId,
          userId: candidate.id,
          status: 'IN_PROGRESS',
        }
      });

      await tx.candidateInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'USED',
          attemptId: attempt.id,
        }
      });

      return { attempt, candidate, organizationId: exam.organizationId };
    });

    const token = this.iamFacade.issueSessionToken({
      userId: result.candidate.id,
      organizationId: result.organizationId,
      email: result.candidate.email,
      roles: ['candidate'],
    });

    return {
      status: 'success',
      attemptId: result.attempt.id,
      token,
      message: 'Invitación reclamada con éxito. Sesión de evaluación inicializada.',
    };
  }

  /**
   * Endpoint de Ingesta Asíncrona de Respuestas.
   * POST /evaluations/attempts/:attemptId/submit
   */
  @ApiOperation({ 
    summary: 'Enviar respuesta de una pregunta de examen', 
    description: 'Encola la respuesta del alumno de forma asíncrona en la cola BullMQ answers-queue y retorna un ID de procesamiento (jobId).' 
  })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @ApiResponse({ status: 202, description: 'La respuesta fue aceptada en la cola de procesamiento.' })
  @ApiResponse({ status: 400, description: 'Payload incorrecto o ID de intento inválido.' })
  @ApiResponse({ status: 401, description: 'No autorizado (Token JWT inválido o expirado).' })
  @ApiResponse({ status: 403, description: 'Prohibido (El intento pertenece a otro estudiante).' })
  @Post('attempts/:attemptId/submit')
  @UseGuards(JwtAuthGuard, AttemptOwnerGuard)
  @HttpCode(HttpStatus.ACCEPTED) // Retorna HTTP 202
  async submitAnswer(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() body: SubmitAnswerBodyDto,
  ) {
    this.logger.log(`Petición de envío de respuesta recibida para intento: ${attemptId}, Pregunta: ${body.questionId}`);

    const result = await this.queueProducer.enqueueAnswer({
      attemptId,
      questionId: body.questionId,
      response: body.response,
      tiempoMs: body.tiempoMs,
    });

    return {
      status: 'accepted',
      message: 'La respuesta ha sido recibida y se encuentra en cola para evaluación.',
      jobId: result.jobId,
    };
  }

  /**
   * Endpoint para registrar el NPS y feedback cualitativo al finalizar.
   * POST /evaluations/attempts/:attemptId/feedback
   */
  @ApiOperation({ 
    summary: 'Registrar encuesta NPS y retroalimentación técnica del alumno', 
    description: 'Guarda la puntuación NPS (0-10) y el comentario cualitativo en la tabla exam_attempts al finalizar la sesión.' 
  })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @ApiResponse({ status: 200, description: 'Retroalimentación técnica registrada exitosamente.' })
  @ApiResponse({ status: 400, description: 'NPS fuera de rango o comentarios demasiado extensos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido.' })
  @Post('attempts/:attemptId/feedback')
  @UseGuards(JwtAuthGuard, AttemptOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async submitFeedback(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() body: SubmitFeedbackDto,
  ) {
    this.logger.log(`Registrando feedback NPS para intento: ${attemptId} | Score: ${body.npsScore}`);

    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        npsScore: body.npsScore,
        feedbackText: body.feedbackText,
      },
    });

    return {
      status: 'success',
      message: 'Retroalimentación técnica guardada de forma exitosa.',
    };
  }

  /**
   * Listar todos los intentos de evaluación finalizados.
   * GET /evaluations/attempts
   */
  @ApiOperation({ 
    summary: 'Listar todos los intentos de evaluación para la consola del reclutador', 
    description: 'Devuelve una lista consolidada de intentos de exámenes incluyendo datos de candidatos (IAM) y títulos (Exams).' 
  })
  @ApiResponse({ status: 200, description: 'Listado de intentos devuelto con éxito.' })
  @Get('attempts')
  @UseGuards(JwtAuthGuard)
  async getAttempts(@Req() req: any) {
    this.ensureStaffRole(req.user);
    this.logger.log('Listando todos los intentos de evaluación finalizados...');

    const tenantExamIds = await this.getTenantExamIds(req.user.organizationId);
    
    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId: { in: tenantExamIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        logs: {
          select: { riskLevel: true }
        }
      }
    });

    const result = [];
    for (const att of attempts) {
      const user = await this.prisma.user.findUnique({
        where: { id: att.userId },
        select: { firstName: true, lastName: true, email: true }
      });

      const exam = await this.prisma.exam.findUnique({
        where: { id: att.examId },
        select: { title: true }
      });

      const logs = att.logs || [];
      const hasCritical = logs.some(l => l.riskLevel === 'CRITICAL');
      const hasWarning = logs.some(l => l.riskLevel === 'WARNING');
      const riskStatus = hasCritical ? 'CRITICAL' : (hasWarning ? 'WARNING' : 'SAFE');
      const statusLabel = riskStatus === 'CRITICAL' ? 'Fraude probable' : (riskStatus === 'WARNING' ? 'Sospechoso' : 'Sin alertas');

      result.push({
        id: att.id,
        candidateName: user ? `${user.firstName} ${user.lastName}`.trim() : 'Candidato Externo',
        email: user?.email || 'unknown@example.com',
        assessmentTitle: exam?.title || 'Evaluación Psicométrica',
        date: att.submittedAt ? att.submittedAt.toLocaleString() : att.startedAt.toLocaleString(),
        overallScore: att.score ? `${att.score}/100` : 'Pendiente',
        incidentsCount: logs.length,
        riskStatus,
        statusLabel,
      });
    }

    return result;
  }

  /**
   * Obtener sesión real de examen para el candidato.
   * GET /evaluations/attempts/:attemptId/session
   */
  @ApiOperation({ summary: 'Obtener datos reales de la sesión de examen del candidato' })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @Get('attempts/:attemptId/session')
  @UseGuards(JwtAuthGuard, AttemptOwnerGuard)
  async getAttemptSession(@Param('attemptId', ParseUUIDPipe) attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      throw new NotFoundException('Intento de examen no encontrado.');
    }

    if (!['IN_PROGRESS', 'SUBMITTED'].includes(attempt.status)) {
      throw new BadRequestException('El intento no se encuentra disponible para el candidato.');
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: attempt.examId },
    });

    if (!exam) {
      throw new NotFoundException('Evaluación no encontrada.');
    }

    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId: exam.id },
      orderBy: { sortOrder: 'asc' },
    });

    const questions = await this.prisma.question.findMany({
      where: { id: { in: examQuestions.map((q) => q.questionId) } },
    });
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    const safeQuestions = examQuestions
      .map((examQuestion) => {
        const question = questionMap.get(examQuestion.questionId);
        if (!question) return null;
        const content = this.stripCorrectConfig(question.contentJsonb as any);
        return {
          id: question.id,
          type: question.type,
          defaultPoints: Number(examQuestion.points || question.defaultPoints),
          content,
        };
      })
      .filter(Boolean);

    return {
      attemptId: attempt.id,
      status: attempt.status,
      exam: {
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
      },
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      questions: safeQuestions,
    };
  }

  /**
   * Finalizar intento de forma idempotente.
   * POST /evaluations/attempts/:attemptId/finalize
   */
  @ApiOperation({ summary: 'Finalizar intento de evaluación de forma idempotente' })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @Post('attempts/:attemptId/finalize')
  @UseGuards(JwtAuthGuard, AttemptOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async finalizeAttempt(@Param('attemptId', ParseUUIDPipe) attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      throw new NotFoundException('Intento de examen no encontrado.');
    }

    if (attempt.status === 'COMPLETED') {
      return {
        status: attempt.status,
        message: 'El intento ya había sido finalizado previamente.',
      };
    }

    if (attempt.status === 'SUBMITTED') {
      await this.answersProcessor.consolidateAttemptScore(attemptId);
      return {
        status: 'COMPLETED',
        message: 'El intento ya estaba enviado y fue consolidado nuevamente.',
      };
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('El intento no puede finalizarse desde su estado actual.');
    }

    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    await this.answersProcessor.consolidateAttemptScore(attemptId);

    return {
      status: 'COMPLETED',
      message: 'Intento finalizado y consolidado con las respuestas recibidas.',
    };
  }

  /**
   * Obtener reporte consolidado detallado de un intento.
   * GET /evaluations/attempts/:attemptId
   */
  @ApiOperation({ 
    summary: 'Obtener reporte consolidado detallado de un intento', 
    description: 'Devuelve el informe conductual psicométrico por dimensiones y el timeline de proctoring de un candidato.' 
  })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @ApiResponse({ status: 200, description: 'Reporte del candidato devuelto con éxito.' })
  @ApiResponse({ status: 404, description: 'Intento de examen no encontrado.' })
  @Get('attempts/:attemptId')
  @UseGuards(JwtAuthGuard)
  async getAttemptReport(@Req() req: any, @Param('attemptId', ParseUUIDPipe) attemptId: string) {
    this.ensureStaffRole(req.user);
    this.logger.log(`Generando reporte para el intento: ${attemptId}`);

    const att = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        logs: {
          orderBy: { timestamp: 'asc' }
        },
        ltiMapping: true
      }
    });

    if (!att) {
      throw new BadRequestException('Intento de examen no encontrado.');
    }

    await this.assertAttemptInTenant(att.examId, req.user.organizationId);

    const user = await this.prisma.user.findUnique({
      where: { id: att.userId },
      select: { firstName: true, lastName: true, email: true }
    });

    const exam = await this.prisma.exam.findUnique({
      where: { id: att.examId },
      select: { title: true }
    });

    const dimensions = [];
    if (att.scoreDetails) {
      const details = att.scoreDetails as any;
      for (const [dimName, val] of Object.entries(details)) {
        const dimVal = val as any;
        dimensions.push({
          name: dimName,
          score: dimVal.percentage || 0,
          description: this.getDimensionDescription(dimName),
        });
      }
    } else {
      dimensions.push(
        { name: 'INTEGRIDAD', score: 0, description: 'Pendiente de calificación por el worker.' },
        { name: 'LEALTAD ORGANIZACIONAL', score: 0, description: 'Pendiente de calificación por el worker.' },
        { name: 'TOLERANCIA AL RIESGO', score: 0, description: 'Pendiente de calificación por el worker.' }
      );
    }

    const logsMapped = att.logs.map(log => ({
      id: log.id,
      eventType: log.eventType,
      riskLevel: log.riskLevel,
      timestamp: log.timestamp.toLocaleTimeString(),
      metadata: log.metadata || {},
      message: this.getLogMessage(log.eventType),
    }));

    return {
      candidateName: user ? `${user.firstName} ${user.lastName}`.trim() : 'Candidato Externo',
      email: user?.email || 'unknown@example.com',
      assessmentTitle: exam?.title || 'Evaluación Psicométrica',
      date: att.submittedAt ? att.submittedAt.toLocaleString() : att.startedAt.toLocaleString(),
      overallScore: att.score ? `${att.score}/100` : '0/100',
      ipAddress: att.ipAddress || '127.0.0.1',
      userAgent: att.userAgent || 'Mozilla/5.0 Browser',
      sessionHmac: att.ltiMapping ? `lti-${att.ltiMapping.id}` : 'session-audit-metadata',
      dimensions,
      proctoringLogs: logsMapped,
    };
  }

  private getDimensionDescription(dimName: string): string {
    const desc: Record<string, string> = {
      'INTEGRIDAD': 'Indica apego a las normas éticas y baja propensión a justificar actos deshonestos.',
      'SOCIABILIDAD': 'Mide el nivel de empatía e integración del candidato en equipos de trabajo.',
      'LEALTAD': 'Mide la coincidencia con los valores corporativos y la confidencialidad organizacional.',
      'GENERAL': 'Puntuación analítica consolidada general del reactivo.',
    };
    return desc[dimName] || 'Dimensión psicométrica de perfil conductual.';
  }

  private getLogMessage(eventType: string): string {
    const msg: Record<string, string> = {
      'tab_focus_lost': 'Pérdida de foco: Estudiante sale de la ventana del examen (cambio de pestaña/app).',
      'tab_focus_gained': 'Foco restablecido: El estudiante regresa a la interfaz de toma del reactivo.',
      'student_idle': 'Inactividad prolongada detectada en el cliente.',
      'suspicious_behavior_detected': 'COMPORTAMIENTO SOSPECHOSO: Alerta por excesiva pérdida de foco.',
      'identity_snapshot': 'CAPTURA DE IDENTIDAD: Captura periódica por webcam registrada.',
    };
    return msg[eventType] || 'Evento de telemetría de sesión registrado.';
  }

  /**
   * Endpoint de Supervisión Activa: Recibe y guarda fotos del candidato en tiempo real.
   * POST /evaluations/attempts/:attemptId/snapshots
   */
  @ApiOperation({ 
    summary: 'Subir captura de foto de webcam/celular en tiempo real', 
    description: 'Recibe una foto codificada en Base64, la guarda en el disco del servidor y registra un evento de supervisión en base de datos.' 
  })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @ApiResponse({ status: 201, description: 'La foto fue capturada y guardada con éxito.' })
  @ApiResponse({ status: 400, description: 'La imagen Base64 no es válida.' })
  @Post('attempts/:attemptId/snapshots')
  @UseGuards(JwtAuthGuard, AttemptOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  async uploadSnapshot(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() body: SubmitSnapshotDto,
  ) {
    this.logger.log(`Recibiendo foto de supervisión para el intento: ${attemptId}`);

    if (!body.image || !body.image.includes('base64,')) {
      throw new BadRequestException('El formato de la imagen Base64 no es válido.');
    }

    try {
      const base64Data = body.image.split('base64,')[1] || '';
      const approxBytes = Math.floor((base64Data.length * 3) / 4);

      const lastLog = await this.prisma.attemptLog.findFirst({
        where: { examAttemptId: attemptId },
        orderBy: { timestamp: 'desc' },
      });
      const sequence = lastLog && lastLog.metadata ? ((lastLog.metadata as any).sequence || 0) + 1 : 1;

      await this.prisma.attemptLog.create({
        data: {
          examAttemptId: attemptId,
          eventType: 'identity_snapshot',
          riskLevel: 'INFO',
          metadata: {
            sequence,
            snapshotStored: false,
            approxBytes,
            reason: 'Public snapshot storage disabled until private storage is implemented.',
          },
        },
      });

      return {
        status: 'success',
        message: 'Metadata de captura registrada. El archivo no fue almacenado públicamente.',
        imageStored: false,
      };
    } catch (err) {
      this.logger.error(`Error al registrar metadata de supervisión: ${err.message}`, err.stack);
      throw new BadRequestException(`Fallo al registrar metadata de supervisión: ${err.message}`);
    }
  }

  /**
   * Obtener resultados de la sesión, incluyendo IGA.
   * GET /evaluations/attempts/:attemptId/resultados
   */
  @ApiOperation({ summary: 'Obtener resultados globales detallados e Índice IGA de un intento' })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @ApiResponse({ status: 200, description: 'Resultados e IGA calculados devueltos con éxito.' })
  @Get('attempts/:attemptId/resultados')
  @UseGuards(JwtAuthGuard)
  async getAttemptResultados(@Req() req: any, @Param('attemptId', ParseUUIDPipe) attemptId: string) {
    this.ensureStaffRole(req.user);
    this.logger.log(`Obteniendo resultados e IGA para el intento: ${attemptId}`);

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        resultadosTest: true,
        resultadoGlobal: {
          include: {
            perfil: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new BadRequestException('Intento de examen no encontrado.');
    }

    await this.assertAttemptInTenant(attempt.examId, req.user.organizationId);

    // Calcular IGA si no existe en la caché
    let igaResult = null;
    if (!attempt.resultadoGlobal) {
      try {
        igaResult = await this.igaCalculator.calcularIga(attemptId);
      } catch (err) {
        this.logger.warn(`Fallo al calcular IGA de forma automática: ${err.message}`);
      }
    } else {
      igaResult = {
        iga: Number(attempt.resultadoGlobal.iga),
        recomendacion: attempt.resultadoGlobal.recomendacion,
        alertas: attempt.resultadoGlobal.alertas as string[],
      };
    }

    const testResults: Record<string, any> = {};
    const dbTestResults = attempt.resultadosTest.length > 0
      ? attempt.resultadosTest
      : (await this.prisma.resultadoTest.findMany({ where: { examAttemptId: attemptId } }));

    for (const r of dbTestResults) {
      let categoria = 'Desconocido';
      if (r.theta !== null && r.theta !== undefined) {
        const thetaVal = Number(r.theta);
        const cut = await this.prisma.cutScore.findFirst({
          where: {
            testId: r.testId,
            thetaMin: { lte: thetaVal },
            OR: [
              { thetaMax: null },
              { thetaMax: { gt: thetaVal } }
            ]
          }
        });
        if (cut) {
          categoria = cut.categoria;
        } else {
          if (thetaVal < -1.5) categoria = 'Básico';
          else if (thetaVal < 0.5) categoria = 'En desarrollo';
          else if (thetaVal < 1.5) categoria = 'Competente';
          else categoria = 'Sobresaliente';
        }
      } else if (r.percentil !== null && r.percentil !== undefined) {
        const pctVal = Number(r.percentil);
        if (pctVal < 25) categoria = 'Básico';
        else if (pctVal < 75) categoria = 'En desarrollo';
        else if (pctVal < 90) categoria = 'Competente';
        else categoria = 'Sobresaliente';
      }

      testResults[r.testId] = {
        puntaje_bruto: Number(r.puntajeBruto),
        percentil: r.percentil !== null ? Number(r.percentil) : null,
        theta: r.theta !== null ? Number(r.theta) : null,
        theta_error: r.thetaError !== null ? Number(r.thetaError) : null,
        theta_t: r.thetaT !== null ? Number(r.thetaT) : null,
        theta_ci: r.thetaCi !== null ? Number(r.thetaCi) : null,
        irt_calculated: r.irtCalculated,
        categoria,
      };
    }

    return {
      sesion_id: attemptId,
      perfil_puesto: attempt.resultadoGlobal?.perfil?.nombre || 'Gerente General (Default)',
      estado: attempt.status,
      resultados_por_test: testResults,
      iga: igaResult ? {
        valor: igaResult.iga,
        recomendacion: igaResult.recomendacion,
        alertas: igaResult.alertas,
      } : null,
    };
  }

  /**
   * Forzar recálculo del IGA (útil si se cambió el perfil de puesto).
   * POST /evaluations/attempts/:attemptId/recalcular-iga
   */
  @ApiOperation({ summary: 'Forzar recálculo del Índice IGA asignando un perfil de puesto' })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @ApiResponse({ status: 200, description: 'IGA recalculado con éxito.' })
  @Post('attempts/:attemptId/recalcular-iga')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async recalcularIga(
    @Req() req: any,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() body: RecalcularIgaDto,
  ) {
    this.ensureStaffRole(req.user);
    this.logger.log(`Petición de recálculo de IGA para intento: ${attemptId} con perfil: ${body.perfilId}`);

    const attempt = await this.prisma.examAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new BadRequestException('Intento de examen no encontrado.');
    await this.assertAttemptInTenant(attempt.examId, req.user.organizationId);

    await this.igaCalculator.calcularIga(attemptId, body.perfilId);

    return this.getAttemptResultados(req, attemptId);
  }

  /**
   * Obtener la lista de perfiles de puesto.
   * GET /evaluations/perfiles
   */
  @ApiOperation({ summary: 'Obtener la lista de todos los perfiles de puesto configurados' })
  @ApiResponse({ status: 200, description: 'Lista de perfiles devuelta con éxito.' })
  @Get('perfiles')
  @UseGuards(JwtAuthGuard)
  async getPerfiles(@Req() req: any) {
    this.ensureStaffRole(req.user);
    return this.prisma.perfilPuesto.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  private normalizeAccessCode(accessCode: string): string {
    if (!accessCode || typeof accessCode !== 'string') {
      throw new BadRequestException('La clave de acceso es requerida.');
    }
    return accessCode.trim().toUpperCase();
  }

  private async generateUniqueAccessCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const accessCode = `IT-${randomInt(100000, 1000000)}`;
      const existing = await this.prisma.candidateInvitation.findUnique({ where: { accessCode } });
      if (!existing) return accessCode;
    }
    throw new BadRequestException('No fue posible generar una clave de acceso única.');
  }

  private isUuid(value?: string): boolean {
    return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private ensureStaffRole(user: SessionUser): void {
    const roles = user?.roles || [];
    const allowed = ['admin', 'recruiter', 'psychologist', 'evaluator'];
    if (!roles.some((role) => allowed.includes(role))) {
      throw new ForbiddenException('No tienes permisos para acceder a este recurso.');
    }
  }

  private async getTenantExamIds(organizationId: string): Promise<string[]> {
    const exams = await this.prisma.exam.findMany({
      where: { organizationId },
      select: { id: true },
    });
    return exams.map((exam) => exam.id);
  }

  private async assertAttemptInTenant(examId: string, organizationId: string): Promise<void> {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, organizationId },
      select: { id: true },
    });
    if (!exam) {
      throw new ForbiddenException('El intento no pertenece a tu organización.');
    }
  }

  private async resolveExamForInvitation(examId: string, user: SessionUser) {
    if (this.isUuid(examId)) {
      const exam = await this.prisma.exam.findFirst({
        where: {
          id: examId,
          organizationId: user.organizationId,
        },
      });
      if (exam) return exam;
    }

    const fallbackExam = await this.prisma.exam.findFirst({
      where: {
        organizationId: user.organizationId,
        isPublished: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!fallbackExam) {
      throw new BadRequestException('No existe una evaluación publicada para crear la invitación.');
    }
    return fallbackExam;
  }

  private stripCorrectConfig(content: any): any {
    if (!content || typeof content !== 'object') return content;
    const { correctConfig, correctAnswer, correctAnswers, ...safeContent } = content;
    return safeContent;
  }
}
