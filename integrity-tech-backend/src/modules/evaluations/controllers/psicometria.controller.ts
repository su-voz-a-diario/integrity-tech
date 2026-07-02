import { Controller, Get, Post, Param, Query, HttpCode, HttpStatus, Logger, NotFoundException, ConflictException, Body } from '@nestjs/common';
import { ThetaCalculatorService } from '../services/theta-calculator.service';
import { PersonFitService } from '../services/person-fit.service';
import { CatService } from '../services/cat.service';
import { ReportGeneratorService } from '../services/report-generator.service';
import { AdverseImpactService } from '../services/adverse-impact.service';
import { RoiService } from '../services/roi.service';
import { ContinuousNormingService } from '../services/continuous-norming.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Psicometría Avanzada (IRT)')
@Controller()
export class PsicometriaController {
  private readonly logger = new Logger(PsicometriaController.name);

  constructor(
    private readonly thetaService: ThetaCalculatorService,
    private readonly personFitService: PersonFitService,
    private readonly catService: CatService,
    private readonly reportService: ReportGeneratorService,
    private readonly adverseImpactService: AdverseImpactService,
    private readonly roiService: RoiService,
    private readonly continuousNormingService: ContinuousNormingService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Obtener parámetros de ítems para un test' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Get('api/v1/psicometria/parametros/:test_id')
  async getParameters(@Param('test_id') testId: string) {
    return this.prisma.parametrosItems.findMany({
      where: { testId },
    });
  }

  @ApiOperation({ summary: 'Lanzar calibración psicométrica offline (2PL / GRM)' })
  @Post('api/v1/psicometria/calibrar')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerCalibration() {
    const lockKey = 123456;
    const acquired: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT pg_try_advisory_lock($1) AS "acquired";`,
      lockKey
    );
    if (!acquired || acquired.length === 0 || !acquired[0].acquired) {
      throw new ConflictException('Ya hay una calibración en curso.');
    }

    this.logger.log('Disparando calibración IRT offline...');
    
    // Spawn del script Python de forma asíncrona
    const { spawn } = require('child_process');
    const pythonProcess = spawn('python3', ['scripts/calibrate.py'], {
      env: { ...process.env },
    });

    pythonProcess.on('close', async () => {
      await this.prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock($1);`, lockKey);
      await this.thetaService.clearCache();
      this.logger.log('Calibración completada y bloqueo pg_advisory_unlock liberado.');
    });

    pythonProcess.stdout.on('data', (data: Buffer) => {
      this.logger.log(`[Python Calibrar] ${data.toString().trim()}`);
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      this.logger.error(`[Python Calibrar Error] ${data.toString().trim()}`);
    });

    return {
      status: 'accepted',
      message: 'Calibración psicométrica iniciada en segundo plano.',
    };
  }

  @ApiOperation({ summary: 'Obtener baremo dinámico aplicando especificidad jerárquica' })
  @ApiQuery({ name: 'test_id', required: true })
  @ApiQuery({ name: 'pais', required: false })
  @ApiQuery({ name: 'sector', required: false })
  @ApiQuery({ name: 'nivel_educativo', required: false })
  @ApiQuery({ name: 'tipo_puesto', required: false })
  @Get('api/v1/baremos/dinamicos')
  async getDynamicNorm(
    @Query('test_id') testId: string,
    @Query('pais') pais?: string,
    @Query('sector') sector?: string,
    @Query('nivel_educativo') nivel?: string,
    @Query('tipo_puesto') puesto?: string,
  ) {
    // Llamar a la función jerárquica de PL/pgSQL obtener_baremo_dinamico
    const result: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM obtener_baremo_dinamico($1, $2, $3, $4, $5);`,
      testId,
      pais || null,
      sector || null,
      nivel || null,
      puesto || null
    );
    return result;
  }

  @ApiOperation({ summary: 'Obtener percentil y tamaño de muestra directamente según theta y datos de agrupación' })
  @ApiQuery({ name: 'test_id', required: true })
  @ApiQuery({ name: 'theta', required: true, type: Number })
  @ApiQuery({ name: 'pais', required: false })
  @ApiQuery({ name: 'sector', required: false })
  @ApiQuery({ name: 'nivel_educativo', required: false })
  @ApiQuery({ name: 'tipo_puesto', required: false })
  @Get('api/v1/baremos/percentil')
  async getPercentile(
    @Query('test_id') testId: string,
    @Query('theta') thetaStr: string,
    @Query('pais') pais?: string,
    @Query('sector') sector?: string,
    @Query('nivel_educativo') nivel?: string,
    @Query('tipo_puesto') puesto?: string,
  ) {
    const theta = parseFloat(thetaStr);
    const result: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT percentil, n_muestra FROM obtener_percentil_dinamico($1, $2, $3, $4, $5, $6) LIMIT 1;`,
      testId,
      theta,
      pais || null,
      sector || null,
      nivel || null,
      puesto || null
    );

    if (result.length === 0) {
      throw new NotFoundException(`No se encontró un rango de percentil para theta ${theta} en el test ${testId}`);
    }

    return {
      percentil: result[0].percentil,
      nMuestra: result[0].n_muestra,
    };
  }

  @ApiOperation({ summary: 'Obtener nivel de habilidad latente (theta) de un intento' })
  @ApiParam({ name: 'id', description: 'ID del intento de examen (UUID)' })
  @Get('evaluations/attempts/:id/theta')
  async getAttemptTheta(@Param('id') id: string) {
    const resultados = await this.prisma.resultadoTest.findMany({
      where: { examAttemptId: id },
      select: {
        testId: true,
        theta: true,
        thetaError: true,
        irtCalculated: true,
      },
    });

    if (resultados.length === 0) {
      throw new NotFoundException(`No se encontraron resultados psicométricos para el intento: ${id}`);
    }

    return resultados;
  }

  @ApiOperation({ summary: 'Obtener la curva de información del test (TIF) y el error estándar condicional' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Get('api/v1/psicometria/:test_id/informacion')
  async getTestInformation(@Param('test_id') testId: string) {
    return this.thetaService.getTestInformation(testId);
  }

  @ApiOperation({ summary: 'Obtener los estándares de competencia (Cut-scores) configurados para un test' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Get('api/v1/psicometria/:test_id/cut-scores')
  async getCutScores(@Param('test_id') testId: string) {
    return this.prisma.cutScore.findMany({
      where: { testId },
      orderBy: { orden: 'asc' },
    });
  }

  @ApiOperation({ summary: 'Obtener ítems con desajuste psicométrico significativo (p < 0.01 o RMSEA elevado)' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Get('api/v1/psicometria/items/:test_id/mal-ajuste')
  async getMisfittingItems(@Param('test_id') testId: string) {
    return this.prisma.parametrosItems.findMany({
      where: {
        testId,
        OR: [
          { pValueAjuste: { lt: 0.01 } },
          { rmseaItem: { gt: 0.08 } }
        ]
      },
    });
  }

  @ApiOperation({ summary: 'Obtener el historial completo de calibraciones y parámetros pasados del test' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Get('api/v1/psicometria/parametros/:test_id/historial')
  async getParametersHistory(@Param('test_id') testId: string) {
    return this.prisma.parametrosItemsHistorial.findMany({
      where: { testId },
      orderBy: { fechaArchivado: 'desc' },
    });
  }

  @ApiOperation({ summary: 'Obtener el panel histórico de calidad psicométrica (drift, fiabilidad, etc.)' })
  @ApiQuery({ name: 'test_id', required: false })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @Get('api/v1/psicometria/quality')
  async getPsychometricQualityDashboard(
    @Query('test_id') testId?: string,
    @Query('days') daysStr?: string,
  ) {
    const days = daysStr ? parseInt(daysStr, 10) : 30;
    const filterDate = new Date();
    filterDate.setDate(filterDate.getDate() - days);

    return this.prisma.psychometricQualityLog.findMany({
      where: {
        ...(testId ? { testId } : {}),
        fecha: { gte: filterDate },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  @ApiOperation({ summary: 'Obtener ítems con sesgo demográfico significativo (DIF)' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Get('api/v1/psicometria/dif/:test_id')
  async getItemsWithDIF(@Param('test_id') testId: string) {
    return this.prisma.parametrosItems.findMany({
      where: {
        testId,
        flagDif: true,
      },
    });
  }

  @ApiOperation({ summary: 'Recalcular retroactivamente theta, error, escalas y percentil para históricos usando los parámetros vigentes' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Post('api/v1/psicometria/recalcular-historico/:test_id')
  async recalculateHistoricalScores(@Param('test_id') testId: string) {
    this.logger.log(`Recálculo retroactivo iniciado para test: ${testId}`);
    
    const resultados = await this.prisma.resultadoTest.findMany({
      where: { testId, irtCalculated: true },
    });

    let count = 0;

    for (const r of resultados) {
      const submissions = await this.prisma.answerSubmission.findMany({
        where: { examAttemptId: r.examAttemptId },
      });

      const questionIds = submissions.map(s => s.questionId);
      const questions = await this.prisma.question.findMany({
        where: { id: { in: questionIds } },
      });

      const questionsMap = new Map<string, any>();
      for (const q of questions) {
        questionsMap.set(q.id, q);
      }

      const mapping = {
        'INTEGRIDAD': 'IT2_I',
        'PERSONALIDAD': 'IT2_P10',
        'COGNITIVO': 'IT2_AC10',
        'COMPETENCIAS': 'IT2_CB10',
      };

      const patterns: { itemId: string; response: number }[] = [];
      for (const sub of submissions) {
        const question = questionsMap.get(sub.questionId);
        const content = question?.contentJsonb as any;
        const dimension = content?.dimension || 'GENERAL';
        const mappedTestId = mapping[dimension.toUpperCase()] || dimension;
        if (mappedTestId === testId) {
          const numericResponse = Number(sub.response);
          if (!isNaN(numericResponse)) {
            patterns.push({
              itemId: sub.questionId,
              response: numericResponse,
            });
          }
        }
      }

      if (patterns.length > 0) {
        const { theta, error, thetaT, thetaCi } = await this.thetaService.calcularTheta(testId, patterns);
        const { lz, aberrante } = await this.personFitService.calculatePersonFit(testId, patterns, theta);

        const attempt = await this.prisma.examAttempt.findUnique({
          where: { id: r.examAttemptId },
          select: { userId: true },
        });

        let user = null;
        if (attempt) {
          user = await this.prisma.user.findUnique({
            where: { id: attempt.userId },
            select: { pais: true, sector: true, nivelEducativo: true, tipoPuesto: true },
          });
        }

        let percentilFinal = 50.0;
        try {
          const rawBaremo: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT percentil FROM obtener_percentil_dinamico($1, $2, $3, $4, $5, $6) LIMIT 1;`,
            testId,
            theta,
            user?.pais || null,
            user?.sector || null,
            user?.nivelEducativo || null,
            user?.tipoPuesto || null
          );
          if (rawBaremo && rawBaremo.length > 0) {
            percentilFinal = Number(rawBaremo[0].percentil);
          }
        } catch (dbErr) {
          this.logger.warn(`Error al obtener percentil retroactivo: ${dbErr.message}`);
        }

        await this.prisma.resultadoTest.update({
          where: { id: r.id },
          data: {
            theta,
            thetaError: error,
            thetaT,
            thetaCi,
            personFitLz: lz,
            aberrante,
            percentil: percentilFinal,
          },
        });
        count++;
      }
    }

    return {
      status: 'success',
      message: `Recálculo completado para el test ${testId}.`,
      registrosActualizados: count,
    };
  }

  @ApiOperation({ summary: 'Analizar validez predictiva cargando datos de desempeño' })
  @Post('api/v1/psicometria/validez/analizar')
  async analyzePredictiveValidity(@Body() body: any[]) {
    this.logger.log('Iniciando estudio de validez predictiva...');
    if (!Array.isArray(body) || body.length === 0) {
      throw new ConflictException('Se requiere una lista de datos de desempeño [{email: string, desempeno: number}]');
    }

    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    
    const tempDir = path.join(__dirname, '../../../../scratch');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempJsonPath = path.join(tempDir, `perf_${Date.now()}.json`);
    fs.writeFileSync(tempJsonPath, JSON.stringify(body, null, 2));

    const outputImagePath = '/Volumes/Almacenamiento/integrity-tech/integrity-tech-frontend/public/roc_curve.png';

    return new Promise((resolve, reject) => {
      exec(`python3 scripts/analyze_validity.py "${tempJsonPath}" "${outputImagePath}"`, (error: any, stdout: string, stderr: string) => {
        try {
          if (fs.existsSync(tempJsonPath)) {
            fs.unlinkSync(tempJsonPath);
          }
        } catch (fsErr) {
          this.logger.error(`Error al borrar archivo temporal: ${fsErr.message}`);
        }

        if (error) {
          this.logger.error(`Error de ejecución en análisis de validez: ${stderr || error.message}`);
          reject(new ConflictException(`Fallo al calcular validez predictiva: ${stderr || error.message}`));
          return;
        }

        const lines = stdout.split('\n');
        let jsonStr = '';
        let capturing = false;

        for (const line of lines) {
          if (line.trim() === 'RESULT_START') {
            capturing = true;
            continue;
          }
          if (line.trim() === 'RESULT_END') {
            capturing = false;
            break;
          }
          if (capturing) {
            jsonStr += line;
          }
        }

        try {
          const parsed = JSON.parse(jsonStr);
          resolve(parsed);
        } catch (jsonErr) {
          this.logger.error(`Fallo al parsear JSON del script: ${jsonStr || stdout}`);
          reject(new ConflictException('El script de análisis no devolvió un JSON válido.'));
        }
      });
    });
  }

  @ApiOperation({ summary: 'Generar reporte narrativo (NLG) para un intento de examen' })
  @ApiParam({ name: 'attempt_id', description: 'ID del intento (ej. UUID v7)' })
  @Get('api/v1/psicometria/reporte/:attempt_id/narrativo')
  async getReporteNarrativo(@Param('attempt_id') attemptId: string) {
    const content = await this.reportService.generateNarrativeReport(attemptId);
    return {
      status: 'success',
      reporteMarkdown: content,
    };
  }

  @ApiOperation({ summary: 'Calcular el Impacto Adverso por demografías de grupo (Regla del 80%)' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Get('api/v1/psicometria/impacto-adverso/:test_id')
  async getImpactoAdverso(@Param('test_id') testId: string) {
    return this.adverseImpactService.calculateAdverseImpact(testId);
  }

  @ApiOperation({ summary: 'Calcular el ROI del talento mediante modelo BCG (Brogden-Cronbach-Gleser)' })
  @Post('api/v1/psicometria/roi/calcular')
  async getRoiCalcular(@Body() body: any) {
    return this.roiService.calculateROI(body);
  }

  @ApiOperation({ summary: 'Seleccionar siguiente reactivo adaptativo CAT utilizando MII' })
  @Post('api/v1/psicometria/cat/siguiente')
  async selectCatItem(@Body() body: { testId: string; answeredItemIds: string[]; currentTheta: number; provisionalSe: number }) {
    return this.catService.selectNextItem(
      body.testId,
      body.answeredItemIds,
      body.currentTheta,
      body.provisionalSe
    );
  }

  @ApiOperation({ summary: 'Calibrar normas continuas suavizadas GAMLSS para un test específico' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Post('api/v1/psicometria/baremo-continuo/calibrar/:test_id')
  async runContinuousNormingCalibration(@Param('test_id') testId: string) {
    return this.continuousNormingService.runContinuousCalibration(testId);
  }

  @ApiOperation({ summary: 'Consultar percentil suavizado continuo mediante interpolación lineal' })
  @Get('api/v1/psicometria/baremo-continuo/percentil')
  async getPercentileContinuous(
    @Query('testId') testId: string,
    @Query('theta') theta: string,
    @Query('pais') pais?: string,
    @Query('nivelEducativo') nivelEducativo?: string,
    @Query('tipoPuesto') tipoPuesto?: string,
  ) {
    const p = await this.continuousNormingService.getPercentileContinuous(
      testId,
      parseFloat(theta),
      pais,
      nivelEducativo,
      tipoPuesto
    );
    return {
      testId,
      theta: parseFloat(theta),
      percentil: p,
    };
  }
}
