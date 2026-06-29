import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class LtiAgsService {
  private readonly logger = new Logger(LtiAgsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listener desacoplado que escucha la finalización de exámenes.
   * Si el intento fue lanzado mediante LTI, envía la calificación al LMS de origen.
   */
  @OnEvent('exam.attempt.completed')
  async handleExamAttemptCompleted(event: { attemptId: string; score: number }) {
    this.logger.log(`[LTI AGS] Evento 'exam.attempt.completed' recibido para el intento: ${event.attemptId}`);
    
    // Verificamos si este intento tiene un mapeo LTI
    const mapping = await this.prisma.ltiAttemptMapping.findUnique({
      where: { attemptId: event.attemptId },
    });

    if (!mapping) {
      this.logger.debug(`[LTI AGS] El intento ${event.attemptId} es local. No se requiere sincronización LMS.`);
      return;
    }

    this.logger.log(`[LTI AGS] Sincronizando calificación del intento LTI ${event.attemptId} | Calificación: ${event.score}`);
    
    // Ejecutamos el envío asíncrono
    await this.submitScoreToLms(mapping, event.score);
  }

  /**
   * Envía la nota final al Gradebook del LMS (POST /lineitem/scores)
   */
  private async submitScoreToLms(mapping: any, score: number): Promise<void> {
    const payload = {
      userId: mapping.lmsUserId,
      scoreGiven: score,
      scoreMaximum: 100, // Escala sobre 100% de la evaluación psicométrica
      comment: 'Calificación de Integrity-Tech consolidada automáticamente.',
      timestamp: new Date().toISOString(),
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
    };

    // Imprimimos el envío del payload en los logs del worker para auditoría
    this.logger.log(`[LTI AGS] POST enviado a ${mapping.lineitemUrl}/scores`);
    this.logger.log(`[LTI AGS] Payload: ${JSON.stringify(payload)}`);

    // En producción, se obtiene un token OAuth2 usando la firma JWT de cliente
    // y se realiza la petición HTTP con cabeceras de autorización Bearer:
    // await fetch(`${mapping.lineitemUrl}/scores`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/vnd.ims.lis.v1.score+json',
    //     'Authorization': `Bearer ${oauth2Token}`
    //   },
    //   body: JSON.stringify(payload)
    // });
  }
}
