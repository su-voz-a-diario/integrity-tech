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
      const organizations = await this.prisma.organization.findMany({
        where: { isActive: true },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });

      for (const organization of organizations) {
        await this.runNocturnalCalibrationForOrganization(organization.id);
      }

    } catch (err) {
      this.logger.error(`Fallo en el job de calibración nocturna: ${err.message}`, err.stack);
    } finally {
      await this.prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock($1);`, lockKey);
      this.isRunning = false;
    }
  }


  private async runNocturnalCalibrationForOrganization(organizationId: string) {
    const lastParam = await this.prisma.parametrosItems.findFirst({
      where: { organizationId },
      orderBy: { fechaCalibracion: 'desc' },
    });
    const lastCalibratedDate = lastParam?.fechaCalibracion || new Date(0);

    const newAttemptsCount = await this.prisma.examAttempt.count({
      where: {
        organizationId,
        status: 'COMPLETED',
        submittedAt: { gt: lastCalibratedDate },
      },
    });

    this.logger.log(`Organización ${organizationId}: nuevos intentos completados desde última calibración: ${newAttemptsCount} / 500 requeridos.`);

    if (newAttemptsCount < 500 && lastParam) {
      this.logger.log(`Organización ${organizationId}: muestra insuficiente para recalibración IRT. Manteniendo parámetros vigentes.`);
      return;
    }

    this.logger.log(`Organización ${organizationId}: umbral alcanzado. Iniciando recalibración IRT...`);
    this.thetaService.clearCache();

    const env = { ...process.env, ORGANIZATION_ID: organizationId };
    const { stdout: calOut, stderr: calErr } = await execPromise(`python3 scripts/calibrate.py ${organizationId}`, { env });
    if (calErr) this.logger.error(`[Calibración StdErr][${organizationId}] ${calErr}`);
    this.logger.log(`[Calibración StdOut][${organizationId}] ${calOut.trim()}`);

    this.logger.log(`Organización ${organizationId}: iniciando análisis DIF...`);
    const { stdout: difOut, stderr: difErr } = await execPromise(`python3 scripts/analyze_dif.py ${organizationId}`, { env });
    if (difErr) this.logger.error(`[DIF StdErr][${organizationId}] ${difErr}`);
    this.logger.log(`[DIF StdOut][${organizationId}] ${difOut.trim()}`);

    this.logger.log(`Organización ${organizationId}: reconstruyendo baremos dinámicos tenant-scoped...`);
    await this.regenerateDynamicNormsForOrganization(organizationId);
    this.logger.log(`Organización ${organizationId}: baremos dinámicos recalculados exitosamente.`);
  }

  private async regenerateDynamicNormsForOrganization(organizationId: string) {
    await this.prisma.$executeRawUnsafe(
      `SELECT set_config('app.calibration_organization_id', $1, false);`,
      organizationId,
    );
    await this.prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
          r_comb RECORD;
          v_percentil INTEGER;
          v_theta_val DOUBLE PRECISION;
          v_theta_min DOUBLE PRECISION;
          v_theta_max DOUBLE PRECISION;
          v_organization_id UUID := current_setting('app.calibration_organization_id')::UUID;
      BEGIN
          DELETE FROM baremos_dinamicos
          WHERE organization_id = v_organization_id
            AND n_muestra >= 100;

          FOR r_comb IN
              SELECT att.organization_id, r.test_id, u.pais, u.sector, u.nivel_educativo, u.tipo_puesto, COUNT(*)::INTEGER as cnt
              FROM resultados_test r
              INNER JOIN exam_attempts att ON r.exam_attempt_id = att.id
              INNER JOIN users u ON att.user_id = u.id AND u.organization_id = att.organization_id
              WHERE att.organization_id = v_organization_id
                AND r.theta IS NOT NULL
                AND r.irt_calculated = true
              GROUP BY GROUPING SETS (
                  (att.organization_id, r.test_id, u.pais, u.sector, u.nivel_educativo, u.tipo_puesto),
                  (att.organization_id, r.test_id, u.pais, u.sector, u.nivel_educativo),
                  (att.organization_id, r.test_id, u.pais, u.sector),
                  (att.organization_id, r.test_id, u.pais),
                  (att.organization_id, r.test_id)
              )
              HAVING COUNT(*) >= 100
          LOOP
              v_theta_min := -999.0;
              FOR v_percentil IN 1..99 LOOP
                  SELECT PERCENTILE_CONT(v_percentil / 100.0) WITHIN GROUP (ORDER BY r.theta)
                  INTO v_theta_val
                  FROM resultados_test r
                  INNER JOIN exam_attempts att ON r.exam_attempt_id = att.id
                  INNER JOIN users u ON att.user_id = u.id AND u.organization_id = att.organization_id
                  WHERE att.organization_id = v_organization_id
                    AND r.test_id = r_comb.test_id
                    AND r.theta IS NOT NULL
                    AND r.irt_calculated = true
                    AND (r_comb.pais IS NULL OR u.pais = r_comb.pais)
                    AND (r_comb.sector IS NULL OR u.sector = r_comb.sector)
                    AND (r_comb.nivel_educativo IS NULL OR u.nivel_educativo = r_comb.nivel_educativo)
                    AND (r_comb.tipo_puesto IS NULL OR u.tipo_puesto = r_comb.tipo_puesto);

                  v_theta_max := COALESCE(v_theta_val, -4.0 + (v_percentil * 0.08));

                  INSERT INTO baremos_dinamicos (organization_id, test_id, pais, sector, nivel_educativo, tipo_puesto, theta_min, theta_max, percentil, n_muestra, fecha_creacion)
                  VALUES (r_comb.organization_id, r_comb.test_id, r_comb.pais, r_comb.sector, r_comb.nivel_educativo, r_comb.tipo_puesto, v_theta_min, v_theta_max, v_percentil, r_comb.cnt, NOW());

                  v_theta_min := v_theta_max;
              END LOOP;

              INSERT INTO baremos_dinamicos (organization_id, test_id, pais, sector, nivel_educativo, tipo_puesto, theta_min, theta_max, percentil, n_muestra, fecha_creacion)
              VALUES (r_comb.organization_id, r_comb.test_id, r_comb.pais, r_comb.sector, r_comb.nivel_educativo, r_comb.tipo_puesto, v_theta_min, 999.0, 100, r_comb.cnt, NOW());
          END LOOP;
      END $$;
    `);
  }

  /**
   * Monitoreo diario de calidad psicométrica y detección de corrimiento de habilidad (Drift)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async monitorPsychometricQuality() {
    this.logger.log('Iniciando monitoreo de calidad psicométrica (detección de drift de theta)...');
    try {
      // Obtener estadísticas agregadas por organización y test de los últimos 30 días
      const stats: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT att.organization_id,
               r.test_id,
               AVG(r.theta) AS mean_theta,
               STDDEV(r.theta) AS sd_theta,
               COUNT(*)::INTEGER AS n
        FROM resultados_test r
        INNER JOIN exam_attempts att ON r.exam_attempt_id = att.id
        WHERE r.irt_calculated = TRUE
          AND r.fecha_calculo >= NOW() - INTERVAL '30 days'
        GROUP BY att.organization_id, r.test_id;
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

        const organizationId = row.organization_id;
        if (!organizationId) {
          throw new Error('No existe organización asociada para registrar calidad psicométrica.');
        }

        // Calcular la fiabilidad marginal de la escala (basada en IRT)
        const relMarginal = await this.thetaService.computeMarginalReliability(row.test_id, organizationId);
        this.logger.log(`[Monitoreo IRT] Test: ${row.test_id} | Fiabilidad Marginal (IRT): ${relMarginal.toFixed(3)}`);

        // Registrar en el historial de calidad psicométrica
        await this.prisma.psychometricQualityLog.create({
          data: {
            organizationId,
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
