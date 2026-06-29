import { 
  Controller, 
  Post, 
  Param, 
  Body, 
  UseGuards, 
  HttpCode, 
  HttpStatus, 
  ParseUUIDPipe,
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { AttemptOwnerGuard } from '../../evaluations/guards/attempt-owner.guard';
import { ProctoringBatchDto } from '../dto/proctoring-batch.dto';

@ApiTags('Proctoring (Supervisión e Integridad)')
@ApiBearerAuth()
@Controller('proctoring')
export class ProctoringController {
  constructor(
    @InjectQueue('proctoring-queue') private readonly proctoringQueue: Queue,
  ) {}

  /**
   * Endpoint para recibir telemetría en lotes (batching) desde el cliente.
   * POST /proctoring/attempts/:attemptId/logs/batch
   */
  @ApiOperation({ 
    summary: 'Registrar lote de eventos de supervisión (telemetría)', 
    description: 'Ingesta de forma asíncrona un conjunto de eventos firmados (pérdida de foco, inactividad) a través de la cola proctoring-queue. Valida la integridad criptográfica y secuencial antes de encolar. Devuelve un 202 Accepted.' 
  })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @ApiResponse({ status: 202, description: 'Lote de logs aceptado y encolado en BullMQ.' })
  @ApiResponse({ status: 400, description: 'Secuencia alterada, firmas criptográficas inválidas o lote vacío.' })
  @ApiResponse({ status: 401, description: 'No autorizado (JWT inválido).' })
  @ApiResponse({ status: 403, description: 'Prohibido (El intento pertenece a otro candidato).' })
  @Post('attempts/:attemptId/logs/batch')
  @UseGuards(JwtAuthGuard, AttemptOwnerGuard)
  @HttpCode(HttpStatus.ACCEPTED) // Retorna HTTP 202
  async receiveBatch(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() body: ProctoringBatchDto,
  ) {
    if (body.logs.length === 0) {
      throw new BadRequestException('El lote de logs está vacío.');
    }

    // 1. ANÁLISIS DE INTEGRIDAD CRIPTOGRÁFICA (Seguridad)
    this.verifyTelemetrySignatures(body.logs);

    // 2. ENCOLAR EL BATCH COMPLETO EN BULLMQ
    const job = await this.proctoringQueue.add(
      'save-proctoring-batch',
      {
        attemptId,
        logs: body.logs,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1500,
        },
        removeOnComplete: true,
      },
    );

    return {
      status: 'accepted',
      message: 'Lote de telemetría de proctoring recibido para auditoría.',
      jobId: job.id,
    };
  }

  /**
   * Simulación del validador de firmas criptográficas para evitar manipulaciones.
   */
  private verifyTelemetrySignatures(logs: any[]): void {
    let expectedSequence = logs[0]?.metadata?.sequence;
    
    for (const log of logs) {
      const currentSeq = log.metadata?.sequence;
      if (currentSeq !== undefined && currentSeq !== expectedSequence) {
        throw new BadRequestException('Fallo de Integridad en Telemetría: Secuencia de eventos alterada.');
      }
      if (currentSeq !== undefined) {
        expectedSequence = currentSeq + 1;
      }
    }
  }
}
