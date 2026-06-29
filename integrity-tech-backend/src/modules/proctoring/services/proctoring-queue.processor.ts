import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../../shared/database/prisma.service';

@Processor('proctoring-queue')
export class ProctoringQueueProcessor {
  private readonly logger = new Logger(ProctoringQueueProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('save-proctoring-batch')
  async handleSaveProctoringBatch(job: Job<any>) {
    const { attemptId, logs } = job.data;
    
    this.logger.log(`[Worker] Procesando lote de telemetría (${logs.length} logs) para intento: ${attemptId}`);

    try {
      // 1. INSERCIÓN MASIVA (BULK INSERT) EN POSTGRESQL
      // Utilizar createMany de Prisma optimiza el rendimiento realizando una sola consulta SQL INSERT MULTIVALUES.
      await this.prisma.$transaction(async (tx) => {
        
        await tx.attemptLog.createMany({
          data: logs.map((log: any) => ({
            examAttemptId: attemptId,
            eventType: log.eventType,
            riskLevel: log.riskLevel || 'INFO',
            timestamp: new Date(log.timestamp),
            metadata: log.metadata || {},
          })),
        });

        // 2. ANÁLISIS DE RIESGO DE FRAUDE (Reglas de Negocio)
        // Regla: Si el estudiante pierde el foco de la pantalla ('tab_focus_lost') más de 3 veces
        // en una ventana de 5 minutos, marcamos el intento como bajo alerta sospechosa.
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const tabFocusLostCount = await tx.attemptLog.count({
          where: {
            examAttemptId: attemptId,
            eventType: 'tab_focus_lost',
            timestamp: {
              gte: fiveMinutesAgo,
            },
          },
        });

        if (tabFocusLostCount > 3) {
          this.logger.warn(`[ALERTA DE SEGURIDAD] Intento ${attemptId} excede límite de desfoques. Conteo: ${tabFocusLostCount} en últimos 5 min.`);
          
          // Registrar evento de auditoría de fraude en attempt_logs como CRITICAL
          await tx.attemptLog.create({
            data: {
              examAttemptId: attemptId,
              eventType: 'suspicious_behavior_detected',
              riskLevel: 'CRITICAL',
              metadata: {
                reason: 'Exceso de pérdidas de foco de pestaña (tab_focus_lost > 3 en 5 min)',
                currentFocusLostCount: tabFocusLostCount,
                severity: 'HIGH',
              },
            },
          });

          // En producción, aquí podemos actualizar un flag en la tabla de intentos
          // o disparar un mensaje WebSocket para alertar al docente supervisor en tiempo real.
          await this.notifyProctoringSystem(attemptId, tabFocusLostCount);
        }
      });

    } catch (error) {
      this.logger.error(`Error procesando lote de logs en Job ${job.id}: ${error.message}`);
      throw error; // Activa políticas de reintento en BullMQ
    }
  }

  private async notifyProctoringSystem(attemptId: string, focusLostCount: number): Promise<void> {
    // Simula el envío de una alerta en tiempo real al panel supervisor
    this.logger.debug(`Enviando notificación en tiempo real para intento ${attemptId} con desfoques: ${focusLostCount}`);
  }
}
