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
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { AttemptOwnerGuard } from '../guards/attempt-owner.guard';
import { SubmitAnswerBodyDto } from '../dto/submit-answer.dto';
import { SubmitFeedbackDto } from '../dto/submit-feedback.dto';
import { EvaluationQueueProducer } from '../services/evaluation-queue.producer';
import { PrismaService } from '../../../shared/database/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

export class SubmitSnapshotDto {
  @ApiProperty({ description: 'Imagen capturada de la webcam codificada en Base64', example: 'data:image/jpeg;base64,...' })
  image: string;
}

@ApiTags('Evaluations (Motor de Evaluación)')
@ApiBearerAuth()
@Controller('evaluations')
export class EvaluationController {
  private readonly logger = new Logger(EvaluationController.name);

  constructor(
    private readonly queueProducer: EvaluationQueueProducer,
    private readonly prisma: PrismaService,
  ) {}

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
  async getAttempts() {
    this.logger.log('Listando todos los intentos de evaluación finalizados...');
    
    const attempts = await this.prisma.examAttempt.findMany({
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
        select: { name: true, email: true }
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
        candidateName: user?.name || 'Candidato Externo',
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
  async getAttemptReport(@Param('attemptId', ParseUUIDPipe) attemptId: string) {
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

    const user = await this.prisma.user.findUnique({
      where: { id: att.userId },
      select: { name: true, email: true }
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
      candidateName: user?.name || 'Candidato Externo',
      email: user?.email || 'unknown@example.com',
      assessmentTitle: exam?.title || 'Evaluación Psicométrica',
      date: att.submittedAt ? att.submittedAt.toLocaleString() : att.startedAt.toLocaleString(),
      overallScore: att.score ? `${att.score}/100` : '0/100',
      ipAddress: att.ipAddress || '127.0.0.1',
      userAgent: att.userAgent || 'Mozilla/5.0 Browser',
      sessionHmac: att.ltiMapping ? `lti-${att.ltiMapping.id}` : 'local-attempt-signature-chain',
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
      // 1. Extraer los datos crudos del Base64
      const parts = body.image.split('base64,');
      const base64Data = parts[1];
      const buffer = Buffer.from(base64Data, 'base64');

      // 2. Definir ruta y asegurar que la carpeta existe
      const dirPath = path.join(__dirname, '..', '..', '..', '..', 'public', 'snapshots');
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // 3. Escribir el archivo en disco
      const filename = `${attemptId}-${Date.now()}.jpg`;
      const filePath = path.join(dirPath, filename);
      fs.writeFileSync(filePath, buffer);

      const publicUrl = `/snapshots/${filename}`;
      this.logger.log(`Foto guardada físicamente en: ${filePath} | URL pública: ${publicUrl}`);

      // 4. Registrar en la bitácora de auditoría (logs de proctoring)
      const lastLog = await this.prisma.attemptLog.findFirst({
        where: { attemptId },
        orderBy: { timestamp: 'desc' },
      });
      const sequence = lastLog && lastLog.metadata ? ((lastLog.metadata as any).sequence || 0) + 1 : 1;

      await this.prisma.attemptLog.create({
        data: {
          attemptId,
          eventType: 'identity_snapshot',
          riskLevel: 'INFO',
          metadata: {
            sequence,
            imageUrl: publicUrl,
          },
        },
      });

      return {
        status: 'success',
        message: 'Captura de pantalla registrada de forma exitosa.',
        imageUrl: publicUrl,
      };
    } catch (err) {
      this.logger.error(`Error al procesar la foto de supervisión: ${err.message}`, err.stack);
      throw new BadRequestException(`Fallo al almacenar la imagen en el servidor: ${err.message}`);
    }
  }
}
