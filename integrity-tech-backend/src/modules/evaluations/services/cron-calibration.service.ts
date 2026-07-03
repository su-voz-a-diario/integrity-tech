import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ThetaCalculatorService } from './theta-calculator.service';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

@Injectable()
export class CronCalibrationService {
  private readonly logger = new Logger(CronCalibrationService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly thetaService: ThetaCalculatorService,
  ) {}

  /**
   * Tarea programada nocturna que corre a las 02:00 AM para recalibrar modelos IRT
   * y reconstruir baremos dinámicos empíricos si hay suficiente volumen.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleNocturnalCalibration() {
    if (this.isRunning) {
      this.logger.warn('La calibración nocturna ya está ejecutándose. Saltando ciclo.');
      return;
    }

    const lockKey = 123456;
    const acquired: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT pg_try_advisory_lock($1) AS "acquired";`,
      lockKey
    );
    if (!acquired || acquired.length === 0 || !acquired[0].acquired) {
      this.logger.warn('No se pudo adquirir el bloqueo de calibración (ya hay un proceso activo). Saltando cron nocturno.');
      return;
    }

    this.isRunning = true;
    this.logger.log('Iniciando verificación nocturna de calibración psicométrica...');

    try {
      // 1. Obtener la fecha del último parámetro calibrado
      const lastParam = await this.prisma.parametrosItems.findFirst({
        orderBy: { fechaCalibracion: 'desc' },
      });
      const lastCalibratedDate = lastParam?.fechaCalibracion || new Date(0);

      // 2. Contar cuántos intentos reales se han completado desde la última fecha
      const newAttemptsCount = await this.prisma.examAttempt.count({
        where: {
          status: 'COMPLETED',
          submittedAt: { gt: lastCalibratedDate },
        },
      });

      this.logger.log(`Nuevos intentos completados desde la última calibración: ${newAttemptsCount} / 500 requeridos.`);

      // 3. Ejecutar calibración y baremación si superamos el umbral (o si no hay parámetros)
      if (newAttemptsCount >= 500 || !lastParam) {
        this.logger.log('Umbral de muestra alcanzado. Iniciando recalibración de parámetros de ítems (IRT)...');
        this.thetaService.clearCache();
        
        // Ejecutar script de calibración offline
        const { stdout: calOut, stderr: calErr } = await execPromise('python3 scripts/calibrate.py');
        if (calErr) this.logger.error(`[Calibración StdErr] ${calErr}`);
        this.logger.log(`[Calibración StdOut] ${calOut.trim()}`);

        // Ejecutar script de análisis DIF
        this.logger.log('Iniciando análisis de sesgo demográfico (DIF)...');
        const { stdout: difOut, stderr: difErr } = await execPromise('python3 scripts/analyze_dif.py');
        if (difErr) this.logger.error(`[DIF StdErr] ${difErr}`);
        this.logger.log(`[DIF StdOut] ${difOut.trim()}`);

        // 4. Regenerar baremos dinámicos empíricos de forma nativa en la base de datos
        this.logger.log('Ejecutando procedimiento de reconstrucción de baremos dinámicos en PostgreSQL...');
        await this.prisma.$executeRawUnsafe('SELECT regenerar_baremos_dinamicos();');
        this.logger.log('Baremos dinámicos empíricos recalculados exitosamente.');
      } else {
        this.logger.log('Muestra insuficiente para realizar recalibración IRT. Manteniendo parámetros vigentes.');
      }

    } catch (err) {
      this.logger.error(`Fallo en el job de calibración nocturna: ${err.message}`, err.stack);
    } finally {
      await this.prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock($1);`, lockKey);
      this.isRunning = false;
    }
  }

  /**
   * Monitoreo diario de calidad psicométrica y detección de corrimiento de habilidad (Drift)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async monitorPsychometricQuality() {
    this.logger.log('Iniciando monitoreo de calidad psicométrica (detección de drift de theta)...');
    try {
      // Obtener estadísticas agregadas por test de los últimos 30 días
      const stats: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT test_id,
               AVG(theta) AS mean_theta,
               STDDEV(theta) AS sd_theta,
               COUNT(*)::INTEGER AS n
        FROM resultados_test
        WHERE irt_calculated = TRUE
          AND fecha_calculo >= NOW() - INTERVAL '30 days'
        GROUP BY test_id;
      `);

      for (const row of stats) {
        const mean = Number(row.mean_theta || 0);
        const sd = Number(row.sd_theta || 0);
        const n = Number(row.n || 0);
        
        this.logger.log(`[Monitoreo IRT] Test: ${row.test_id} | Media Theta: ${mean.toFixed(3)} | SD: ${sd.toFixed(3)} | N: ${n}`);
        
        const alert = Math.abs(mean) > 0.3;
        if (alert) {
          this.logger.warn(`[PSICOMETRÍA DRIFT ALERTA] El test ${row.test_id} presenta un desvío significativo de habilidad media (${mean.toFixed(3)}). Se recomienda recalibrar.`);
        }

        const organization = await this.prisma.organization.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (!organization) {
          throw new Error('No existe organización activa para registrar calidad psicométrica.');
        }

        // Calcular la fiabilidad marginal de la escala (basada en IRT)
        const relMarginal = await this.thetaService.computeMarginalReliability(row.test_id, organization.id);
        this.logger.log(`[Monitoreo IRT] Test: ${row.test_id} | Fiabilidad Marginal (IRT): ${relMarginal.toFixed(3)}`);

        // Registrar en el historial de calidad psicométrica
        await this.prisma.psychometricQualityLog.create({
          data: {
            organizationId: organization.id,
            testId: row.test_id,
            nAttempts: n,
            meanTheta: mean,
            sdTheta: sd,
            driftAlert: alert,
            marginalReliability: relMarginal,
          },
        });
      }
    } catch (err) {
      this.logger.error(`Error en el monitoreo de calidad psicométrica: ${err.message}`);
    }
  }
}
