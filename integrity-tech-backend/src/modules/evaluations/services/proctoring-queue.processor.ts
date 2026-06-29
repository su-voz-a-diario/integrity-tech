import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('proctoring-queue')
export class ProctoringQueueProcessor {
  private readonly logger = new Logger(ProctoringQueueProcessor.name);

  constructor() {}

  @Process('save-log')
  async handleSaveLog(job: Job<any>) {
    const { attemptId, eventType, metadata, timestamp } = job.data;
    
    this.logger.log(`Procesando Log de Proctoring ${job.id} para intento ${attemptId}, Evento: ${eventType}`);

    try {
      // PERSISTENCIA EN POSTGRESQL (OPERACIÓN INSERT SIMPLE)
      // query = `
      //   INSERT INTO attempt_logs (id, exam_attempt_id, event_type, timestamp, metadata)
      //   VALUES (generate_uuid_v7(), $1, $2, $3, $4);
      // `;
      
      await this.persistLogToDatabase(attemptId, eventType, metadata, timestamp);

      // OPCIONAL: Lanzar alertas en tiempo real al panel del profesor si el evento es crítico
      if (eventType === 'tab_focus_lost' || eventType === 'ip_change') {
        await this.triggerRealtimeAlert(attemptId, eventType, metadata);
      }

    } catch (error) {
      this.logger.error(`Fallo al procesar Log de Proctoring ${job.id}. Error: ${error.message}`);
      throw error; // Reintento automático manejado por BullMQ
    }
  }

  private async persistLogToDatabase(
    attemptId: string,
    eventType: string,
    metadata: any,
    timestamp: string
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 30);
    });
  }

  private async triggerRealtimeAlert(attemptId: string, eventType: string, metadata: any): Promise<void> {
    // Aquí se inyectaría un Gateway de WebSockets para notificar al panel del docente en tiempo real.
    this.logger.warn(`[ALERTA DE PROCTORING] Intento: ${attemptId} gatilló evento: ${eventType}`);
  }
}
