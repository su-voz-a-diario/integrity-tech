import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });

    // Suscribir a logs de queries en entorno de desarrollo para depuración de rendimiento
    if (process.env.NODE_ENV !== 'production') {
      (this as any).$on('query', (e: any) => {
        this.logger.debug(`Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
      });
    }
  }

  async onModuleInit() {
    this.logger.log('Iniciando conexión a base de datos PostgreSQL mediante Prisma...');
    await this.$connect();
    this.logger.log('Conexión a PostgreSQL establecida con éxito.');

    // Crear la función jerárquica para baremos dinámicos
    try {
      this.logger.log('Definiendo función obtener_baremo_dinamico en PostgreSQL...');
      await this.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION obtener_baremo_dinamico(
            p_test_id VARCHAR,
            p_pais VARCHAR DEFAULT NULL,
            p_sector VARCHAR DEFAULT NULL,
            p_nivel_educativo VARCHAR DEFAULT NULL,
            p_tipo_puesto VARCHAR DEFAULT NULL
        )
        RETURNS TABLE (theta_min DOUBLE PRECISION, theta_max DOUBLE PRECISION, percentil INTEGER, n_muestra INTEGER) AS $$
        BEGIN
            RETURN QUERY
            SELECT bd.theta_min, bd.theta_max, bd.percentil, bd.n_muestra
            FROM baremos_dinamicos bd
            WHERE bd.test_id = p_test_id
              AND (bd.pais IS NOT DISTINCT FROM p_pais)
              AND (bd.sector IS NOT DISTINCT FROM p_sector)
              AND (bd.nivel_educativo IS NOT DISTINCT FROM p_nivel_educativo)
              AND (bd.tipo_puesto IS NOT DISTINCT FROM p_tipo_puesto)
            ORDER BY 
                (CASE WHEN bd.pais IS NOT NULL THEN 1 ELSE 0 END) DESC,
                (CASE WHEN bd.sector IS NOT NULL THEN 1 ELSE 0 END) DESC,
                (CASE WHEN bd.nivel_educativo IS NOT NULL THEN 1 ELSE 0 END) DESC,
                (CASE WHEN bd.tipo_puesto IS NOT NULL THEN 1 ELSE 0 END) DESC
            LIMIT 1;

            -- Fallback: si no es específico, selecciona global (todos nulos)
            IF NOT FOUND THEN
                RETURN QUERY
                SELECT bd.theta_min, bd.theta_max, bd.percentil, bd.n_muestra
                FROM baremos_dinamicos bd
                WHERE bd.test_id = p_test_id
                  AND bd.pais IS NULL AND bd.sector IS NULL AND bd.nivel_educativo IS NULL AND bd.tipo_puesto IS NULL;
            END IF;
        END;
        $$ LANGUAGE plpgsql STABLE;
      `);
      this.logger.log('Función obtener_baremo_dinamico creada/verificada en PostgreSQL.');
    } catch (err) {
      this.logger.error(`Error al crear la función SQL obtener_baremo_dinamico: ${err.message}`);
    }

    // Crear la función obtener_percentil_dinamico
    try {
      this.logger.log('Definiendo función obtener_percentil_dinamico en PostgreSQL...');
      await this.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION obtener_percentil_dinamico(
            p_test_id VARCHAR,
            p_theta DOUBLE PRECISION,
            p_pais VARCHAR DEFAULT NULL,
            p_sector VARCHAR DEFAULT NULL,
            p_nivel_educativo VARCHAR DEFAULT NULL,
            p_tipo_puesto VARCHAR DEFAULT NULL
        ) RETURNS TABLE(percentil INTEGER, n_muestra INTEGER) AS $$
        DECLARE
            v_norm_row RECORD;
        BEGIN
            -- Encontrar el baremo más específico según jerarquía
            SELECT bd.percentil, bd.n_muestra, bd.theta_min, bd.theta_max
            INTO v_norm_row
            FROM baremos_dinamicos bd
            WHERE bd.test_id = p_test_id
              AND bd.theta_min <= p_theta
              AND (bd.theta_max IS NULL OR p_theta < bd.theta_max)  -- intervalo semiabierto
              AND (bd.pais IS NOT DISTINCT FROM p_pais)
              AND (bd.sector IS NOT DISTINCT FROM p_sector)
              AND (bd.nivel_educativo IS NOT DISTINCT FROM p_nivel_educativo)
              AND (bd.tipo_puesto IS NOT DISTINCT FROM p_tipo_puesto)
            ORDER BY
                (bd.pais IS NOT NULL)::int DESC,
                (bd.sector IS NOT NULL)::int DESC,
                (bd.nivel_educativo IS NOT NULL)::int DESC,
                (bd.tipo_puesto IS NOT NULL)::int DESC
            LIMIT 1;

            IF v_norm_row.percentil IS NOT NULL THEN
                percentil := v_norm_row.percentil;
                n_muestra := v_norm_row.n_muestra;
                RETURN NEXT;
            ELSE
                -- Fallback global sin restricción de factores
                SELECT bd.percentil, bd.n_muestra
                INTO percentil, n_muestra
                FROM baremos_dinamicos bd
                WHERE bd.test_id = p_test_id
                  AND bd.theta_min <= p_theta
                  AND (bd.theta_max IS NULL OR p_theta < bd.theta_max)
                  AND bd.pais IS NULL AND bd.sector IS NULL AND bd.nivel_educativo IS NULL AND bd.tipo_puesto IS NULL
                LIMIT 1;

                IF percentil IS NOT NULL THEN
                    n_muestra := n_muestra;
                    RETURN NEXT;
                ELSE
                    -- No hay baremo; devolver percentil 50 por defecto (mediana teórica)
                    percentil := 50;
                    n_muestra := 0;
                    RETURN NEXT;
                END IF;
            END IF;
        END;
        $$ LANGUAGE plpgsql STABLE;
      `);
      this.logger.log('Función obtener_percentil_dinamico creada/verificada en PostgreSQL.');
    } catch (err) {
      this.logger.error(`Error al crear la función SQL obtener_percentil_dinamico: ${err.message}`);
    }

    // Crear la función para regenerar baremos
    try {
      this.logger.log('Definiendo función regenerar_baremos_dinamicos en PostgreSQL...');
      await this.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION regenerar_baremos_dinamicos()
        RETURNS VOID AS $$
        DECLARE
            r_comb RECORD;
            v_percentil INTEGER;
            v_theta_val DOUBLE PRECISION;
            v_theta_min DOUBLE PRECISION;
            v_theta_max DOUBLE PRECISION;
        BEGIN
            -- 1. Limpiar los baremos dinámicos empíricos recalculados (N >= 100)
            DELETE FROM baremos_dinamicos WHERE n_muestra >= 100;

            -- 2. Identificar combinaciones de test y perfiles demográficos de los candidatos en resultados_test usando GROUPING SETS
            FOR r_comb IN
                SELECT r.test_id, u.pais, u.sector, u.nivel_educativo, u.tipo_puesto, COUNT(*)::INTEGER as cnt
                FROM resultados_test r
                INNER JOIN exam_attempts att ON r.exam_attempt_id = att.id
                INNER JOIN users u ON att.user_id = u.id
                WHERE r.theta IS NOT NULL AND r.irt_calculated = true
                GROUP BY GROUPING SETS (
                    (r.test_id, u.pais, u.sector, u.nivel_educativo, u.tipo_puesto),
                    (r.test_id, u.pais, u.sector, u.nivel_educativo),
                    (r.test_id, u.pais, u.sector),
                    (r.test_id, u.pais),
                    (r.test_id)
                )
                HAVING COUNT(*) >= 100
            LOOP
                v_theta_min := -999.0;
                FOR v_percentil IN 1..99 LOOP
                    -- Usar PERCENTILE_CONT para interpolación lineal matemática continua
                    SELECT PERCENTILE_CONT(v_percentil / 100.0) WITHIN GROUP (ORDER BY r.theta)
                    INTO v_theta_val
                    FROM resultados_test r
                    INNER JOIN exam_attempts att ON r.exam_attempt_id = att.id
                    INNER JOIN users u ON att.user_id = u.id
                    WHERE r.test_id = r_comb.test_id
                      AND r.theta IS NOT NULL
                      AND r.irt_calculated = true
                      AND (r_comb.pais IS NULL OR u.pais = r_comb.pais)
                      AND (r_comb.sector IS NULL OR u.sector = r_comb.sector)
                      AND (r_comb.nivel_educativo IS NULL OR u.nivel_educativo = r_comb.nivel_educativo)
                      AND (r_comb.tipo_puesto IS NULL OR u.tipo_puesto = r_comb.tipo_puesto);

                    v_theta_max := COALESCE(v_theta_val, -4.0 + (v_percentil * 0.08));

                    INSERT INTO baremos_dinamicos (test_id, pais, sector, nivel_educativo, tipo_puesto, theta_min, theta_max, percentil, n_muestra, fecha_creacion)
                    VALUES (r_comb.test_id, r_comb.pais, r_comb.sector, r_comb.nivel_educativo, r_comb.tipo_puesto, v_theta_min, v_theta_max, v_percentil, r_comb.cnt, NOW());

                    v_theta_min := v_theta_max;
                END LOOP;

                -- Agregar el percentil 100 (infinito superior)
                INSERT INTO baremos_dinamicos (test_id, pais, sector, nivel_educativo, tipo_puesto, theta_min, theta_max, percentil, n_muestra, fecha_creacion)
                VALUES (r_comb.test_id, r_comb.pais, r_comb.sector, r_comb.nivel_educativo, r_comb.tipo_puesto, v_theta_min, 999.0, 100, r_comb.cnt, NOW());
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;
      `);
      this.logger.log('Función regenerar_baremos_dinamicos creada/verificada en PostgreSQL.');
    } catch (err) {
      this.logger.error(`Error al crear la función SQL regenerar_baremos_dinamicos: ${err.message}`);
    }

    try {
      const count = await this.perfilPuesto.count();
      if (count === 0) {
        this.logger.log('Sembrando perfiles de puesto iniciales en la base de datos...');
        await this.perfilPuesto.createMany({
          data: [
            {
              nombre: 'Gerente Comercial',
              wIntegridad: 0.35,
              wPersonalidad: 0.25,
              wCognitivo: 0.20,
              wCompetencias: 0.20,
            },
            {
              nombre: 'Desarrollador de Software',
              wIntegridad: 0.20,
              wPersonalidad: 0.20,
              wCognitivo: 0.40,
              wCompetencias: 0.20,
            },
            {
              nombre: 'Tesorero / Cajero',
              wIntegridad: 0.60,
              wPersonalidad: 0.15,
              wCognitivo: 0.15,
              wCompetencias: 0.10,
            },
            {
              nombre: 'Director de Recursos Humanos',
              wIntegridad: 0.30,
              wPersonalidad: 0.20,
              wCognitivo: 0.10,
              wCompetencias: 0.40,
            },
          ],
        });
        this.logger.log('Semilla de perfiles de puesto completada.');
      }
    } catch (err) {
      this.logger.warn(`No se pudo ejecutar la semilla de perfiles (¿DB en migración?): ${err.message}`);
    }

    // Sembrar CutScores por defecto si está vacío
    try {
      const cutCount = await this.cutScore.count();
      if (cutCount === 0) {
        this.logger.log('Sembrando estándares de competencia (Cut-scores) por defecto...');
        const testIds = ['IT2_I', 'IT2_P10', 'IT2_AC10', 'IT2_CB10'];
        const cutScoresData = [];
        for (const testId of testIds) {
          cutScoresData.push(
            { testId, categoria: 'Básico', thetaMin: -999.0, thetaMax: -1.5, orden: 1 },
            { testId, categoria: 'En desarrollo', thetaMin: -1.5, thetaMax: 0.5, orden: 2 },
            { testId, categoria: 'Competente', thetaMin: 0.5, thetaMax: 1.5, orden: 3 },
            { testId, categoria: 'Sobresaliente', thetaMin: 1.5, thetaMax: 999.0, orden: 4 }
          );
        }
        await this.cutScore.createMany({
          data: cutScoresData,
        });
        this.logger.log('Semilla de Cut-scores psicométricos completada.');
      }
    } catch (err) {
      this.logger.warn(`No se pudo sembrar los cut-scores: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    this.logger.log('Cerrando conexión a PostgreSQL...');
    await this.$disconnect();
    this.logger.log('Conexión a PostgreSQL cerrada.');
  }
}
