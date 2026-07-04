import { Controller, Get, Post, Param, Query, HttpCode, HttpStatus, Logger, NotFoundException, ConflictException, Body, UseGuards, Req } from '@nestjs/common';
import { ThetaCalculatorService } from '../services/theta-calculator.service';
import { PersonFitService } from '../services/person-fit.service';
import { CatService } from '../services/cat.service';
import { ReportGeneratorService } from '../services/report-generator.service';
import { AdverseImpactService } from '../services/adverse-impact.service';
import { RoiService } from '../services/roi.service';
import { ContinuousNormingService } from '../services/continuous-norming.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { PERMISSIONS, Permissions, PermissionsGuard } from '../../iam';
import { AUDIT_ACTIONS } from '../../audit/audit-event.types';
import { AuditService } from '../../audit/services/audit.service';
import { RateLimit } from '../../../shared/security/rate-limit.decorator';
import { RateLimitGuard } from '../../../shared/security/rate-limit.guard';

@ApiTags('Psicometría Avanzada (IRT)')
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PERMISSIONS.PSYCHOMETRICS_READ)
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
    private readonly auditService: AuditService,
  ) {}

  @ApiOperation({ summary: 'Obtener parámetros de ítems para un test' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Get('api/v1/psicometria/parametros/:test_id')
  async getParameters(@Req() req: any, @Param('test_id') testId: string) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'ParametrosItems', testId);
    return this.prisma.parametrosItems.findMany({
      where: { organizationId: req.user.organizationId, testId },
    });
  }

  @ApiOperation({ summary: 'Lanzar calibración psicométrica offline (2PL / GRM)' })
  @Post('api/v1/psicometria/calibrar')
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: 'psychometrics-write', limit: 3, windowMs: 60_000 })
  @Permissions(PERMISSIONS.PSYCHOMETRICS_WRITE)
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerCalibration(@Req() req: any) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_WRITE, 'PsychometricCalibration');
    const lockKey = 123456;
    const acquired: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT pg_try_advisory_lock($1) AS "acquired";`,
      lockKey
    );
    if (!acquired || acquired.length === 0 || !acquired[0].acquired) {
      throw new ConflictException('Ya hay una calibración en curso.');
    }

    const organizationId = req.user.organizationId;
    this.logger.log(`Disparando calibración IRT offline para organización ${organizationId}...`);
    
    // Spawn del script Python de forma asíncrona
    const { spawn } = require('child_process');
    const pythonProcess = spawn('python3', ['scripts/calibrate.py', organizationId], {
      env: { ...process.env, ORGANIZATION_ID: organizationId },
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
    @Req() req: any,
    @Query('test_id') testId: string,
    @Query('pais') pais?: string,
    @Query('sector') sector?: string,
    @Query('nivel_educativo') nivel?: string,
    @Query('tipo_puesto') puesto?: string,
  ) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'BaremoDinamico', testId, {
      pais,
      sector,
      nivel,
      puesto,
    });
    return this.prisma.baremosDinamicos.findMany({
      where: {
        organizationId: req.user.organizationId,
        testId,
        ...(pais ? { pais } : {}),
        ...(sector ? { sector } : {}),
        ...(nivel ? { nivelEducativo: nivel } : {}),
        ...(puesto ? { tipoPuesto: puesto } : {}),
      },
      orderBy: [{ nMuestra: 'desc' }, { percentil: 'asc' }],
    });
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
    @Req() req: any,
    @Query('test_id') testId: string,
    @Query('theta') thetaStr: string,
    @Query('pais') pais?: string,
    @Query('sector') sector?: string,
    @Query('nivel_educativo') nivel?: string,
    @Query('tipo_puesto') puesto?: string,
  ) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'BaremoDinamico', testId, {
      theta: thetaStr,
      pais,
      sector,
      nivel,
      puesto,
    });
    const theta = parseFloat(thetaStr);
    const result = await this.prisma.baremosDinamicos.findFirst({
      where: {
        organizationId: req.user.organizationId,
        testId,
        thetaMin: { lte: theta },
        thetaMax: { gt: theta },
        ...(pais ? { pais } : {}),
        ...(sector ? { sector } : {}),
        ...(nivel ? { nivelEducativo: nivel } : {}),
        ...(puesto ? { tipoPuesto: puesto } : {}),
      },
      orderBy: { nMuestra: 'desc' },
    });

    if (!result) {
      throw new NotFoundException(`No se encontró un rango de percentil para theta ${theta} en el test ${testId}`);
    }

    return {
      percentil: result.percentil,
      nMuestra: result.nMuestra,
    };
  }

  @ApiOperation({ summary: 'Obtener nivel de habilidad latente (theta) de un intento' })
  @ApiParam({ name: 'id', description: 'ID del intento de examen (UUID)' })
  @Get('evaluations/attempts/:id/theta')
  async getAttemptTheta(@Req() req: any, @Param('id') id: string) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'ExamAttempt', id);
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id, organizationId: req.user.organizationId },
      select: { id: true },
    });
    if (!attempt) {
      throw new NotFoundException(`No se encontró el intento: ${id}`);
    }
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
  async getTestInformation(@Req() req: any, @Param('test_id') testId: string) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'TestInformation', testId);
    return this.thetaService.getTestInformation(testId, req.user.organizationId);
  }

  @ApiOperation({ summary: 'Obtener los estándares de competencia (Cut-scores) configurados para un test' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Get('api/v1/psicometria/:test_id/cut-scores')
  async getCutScores(@Req() req: any, @Param('test_id') testId: string) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'CutScore', testId);
    return this.prisma.cutScore.findMany({
      where: { organizationId: req.user.organizationId, testId },
      orderBy: { orden: 'asc' },
    });
  }

  @ApiOperation({ summary: 'Obtener ítems con desajuste psicométrico significativo (p < 0.01 o RMSEA elevado)' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Get('api/v1/psicometria/items/:test_id/mal-ajuste')
  async getMisfittingItems(@Req() req: any, @Param('test_id') testId: string) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'ParametrosItems', testId, {
      filter: 'misfitting',
    });
    return this.prisma.parametrosItems.findMany({
      where: {
        organizationId: req.user.organizationId,
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
  async getParametersHistory(@Req() req: any, @Param('test_id') testId: string) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'ParametrosItemsHistorial', testId);
    return this.prisma.parametrosItemsHistorial.findMany({
      where: { organizationId: req.user.organizationId, testId },
      orderBy: { fechaArchivado: 'desc' },
    });
  }

  @ApiOperation({ summary: 'Obtener el panel histórico de calidad psicométrica (drift, fiabilidad, etc.)' })
  @ApiQuery({ name: 'test_id', required: false })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @Get('api/v1/psicometria/quality')
  async getPsychometricQualityDashboard(
    @Req() req: any,
    @Query('test_id') testId?: string,
    @Query('days') daysStr?: string,
  ) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'PsychometricQualityLog', testId || null, {
      days: daysStr,
    });
    const days = daysStr ? parseInt(daysStr, 10) : 30;
    const filterDate = new Date();
    filterDate.setDate(filterDate.getDate() - days);

    return this.prisma.psychometricQualityLog.findMany({
      where: {
        organizationId: req.user.organizationId,
        ...(testId ? { testId } : {}),
        fecha: { gte: filterDate },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  @ApiOperation({ summary: 'Obtener ítems con sesgo demográfico significativo (DIF)' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Get('api/v1/psicometria/dif/:test_id')
  async getItemsWithDIF(@Req() req: any, @Param('test_id') testId: string) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'ParametrosItems', testId, {
      filter: 'dif',
    });
    return this.prisma.parametrosItems.findMany({
      where: {
        organizationId: req.user.organizationId,
        testId,
        flagDif: true,
      },
    });
  }

  @ApiOperation({ summary: 'Recalcular retroactivamente theta, error, escalas y percentil para históricos usando los parámetros vigentes' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Post('api/v1/psicometria/recalcular-historico/:test_id')
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: 'psychometrics-write', limit: 5, windowMs: 60_000 })
  @Permissions(PERMISSIONS.PSYCHOMETRICS_WRITE)
  async recalculateHistoricalScores(@Req() req: any, @Param('test_id') testId: string) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_WRITE, 'ResultadoTest', testId, {
      operation: 'historical-recalculation',
    });
    this.logger.log(`Recálculo retroactivo iniciado para test: ${testId}`);
    
    const resultados = await this.prisma.resultadoTest.findMany({
      where: {
        testId,
        irtCalculated: true,
        attempt: { organizationId: req.user.organizationId },
      },
    });

    let count = 0;

    for (const r of resultados) {
      const submissions = await this.prisma.answerSubmission.findMany({
        where: { examAttemptId: r.examAttemptId },
        include: { itemVersion: true },
      });

      const mapping = {
        'INTEGRIDAD': 'IT2_I',
        'PERSONALIDAD': 'IT2_P10',
        'COGNITIVO': 'IT2_AC10',
        'COMPETENCIAS': 'IT2_CB10',
      };

      const patterns: { itemId: string; response: number }[] = [];
      for (const sub of submissions) {
        const stem = sub.itemVersion?.stemJson as any;
        if (!stem) continue;
        const content = stem?.content || stem || {};
        const dimension = content?.dimension || stem?.dimension || 'GENERAL';
        const mappedTestId = mapping[dimension.toUpperCase()] || dimension;
        if (mappedTestId === testId) {
          const numericResponse = Number((sub.response as any)?.value ?? sub.response);
          if (!isNaN(numericResponse)) {
            patterns.push({
              itemId: sub.itemVersionId || sub.questionId,
              response: numericResponse,
            });
          }
        }
      }

      if (patterns.length > 0) {
        const { theta, error, thetaT, thetaCi, engagement } = await this.thetaService.calcularTheta(testId, patterns, req.user.organizationId);
        const { lz, aberrante } = await this.personFitService.calculatePersonFit(testId, patterns, theta);

        const attempt = await this.prisma.examAttempt.findFirst({
          where: { id: r.examAttemptId, organizationId: req.user.organizationId },
          select: { userId: true, organizationId: true },
        });

        let user = null;
        if (attempt) {
          user = await this.prisma.user.findFirst({
            where: { id: attempt.userId, organizationId: req.user.organizationId },
            select: { pais: true, sector: true, nivelEducativo: true, tipoPuesto: true },
          });
        }

        let percentilFinal: number | null = null;
        try {
          const baremo = await this.prisma.baremosDinamicos.findFirst({
            where: {
              organizationId: req.user.organizationId,
              testId,
              thetaMin: { lte: theta },
              thetaMax: { gt: theta },
              ...(user?.pais ? { pais: user.pais } : {}),
              ...(user?.sector ? { sector: user.sector } : {}),
              ...(user?.nivelEducativo ? { nivelEducativo: user.nivelEducativo } : {}),
              ...(user?.tipoPuesto ? { tipoPuesto: user.tipoPuesto } : {}),
            },
            orderBy: { nMuestra: 'desc' },
          });
          if (baremo) {
            percentilFinal = Number(baremo.percentil);
          }
        } catch (dbErr) {
          this.logger.warn(`Error al obtener percentil retroactivo: ${dbErr.message}`);
        }

        if (percentilFinal === null) {
          this.logger.warn(`Sin baremo real para resultado ${r.id} del test ${testId}; se omite actualización de percentil.`);
          continue;
        }

        await this.prisma.resultadoTest.update({
          where: { id: r.id },
          data: {
            theta,
            thetaError: error,
            thetaT,
            thetaCi,
            personFitLz: lz,
            aberrante: aberrante || (engagement < 0.7),
            engagement,
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
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: 'psychometrics-write', limit: 5, windowMs: 60_000 })
  @Permissions(PERMISSIONS.PSYCHOMETRICS_WRITE)
  async analyzePredictiveValidity(@Req() req: any, @Body() body: any[]) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_WRITE, 'PredictiveValidityStudy', null, {
      rows: Array.isArray(body) ? body.length : 0,
    });
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
      const organizationId = req.user.organizationId;
      exec(`python3 scripts/analyze_validity.py "${tempJsonPath}" "${outputImagePath}" "${organizationId}"`, (error: any, stdout: string, stderr: string) => {
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
  async getReporteNarrativo(@Req() req: any, @Param('attempt_id') attemptId: string) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'NarrativeReport', attemptId);
    const content = await this.reportService.generateNarrativeReport(attemptId, req.user.organizationId);
    return {
      status: 'success',
      reporteMarkdown: content,
    };
  }

  @ApiOperation({ summary: 'Calcular el Impacto Adverso por demografías de grupo (Regla del 80%)' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Get('api/v1/psicometria/impacto-adverso/:test_id')
  async getImpactoAdverso(@Req() req: any, @Param('test_id') testId: string) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'AdverseImpact', testId);
    return this.adverseImpactService.calculateAdverseImpact(testId, req.user.organizationId);
  }

  @ApiOperation({ summary: 'Calcular el ROI del talento mediante modelo BCG (Brogden-Cronbach-Gleser)' })
  @Post('api/v1/psicometria/roi/calcular')
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: 'psychometrics-write', limit: 20, windowMs: 60_000 })
  async getRoiCalcular(@Req() req: any, @Body() body: any) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_WRITE, 'TalentRoi', null);
    return this.roiService.calculateROI(body);
  }

  @ApiOperation({ summary: 'Seleccionar siguiente reactivo adaptativo CAT utilizando MII' })
  @Post('api/v1/psicometria/cat/siguiente')
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: 'psychometrics-write', limit: 60, windowMs: 60_000 })
  async selectCatItem(
    @Req() req: any,
    @Body() body: { testId: string; answeredItemIds: string[]; currentTheta: number; provisionalSe: number },
  ) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_WRITE, 'CatSession', body.testId, {
      answeredItems: body.answeredItemIds?.length || 0,
    });
    return this.catService.selectNextItem(
      body.testId,
      req.user.organizationId,
      body.answeredItemIds,
      body.currentTheta,
      body.provisionalSe
    );
  }

  @ApiOperation({ summary: 'Calibrar normas continuas suavizadas GAMLSS para un test específico' })
  @ApiParam({ name: 'test_id', description: 'ID del test (ej. IT2_AC10)' })
  @Post('api/v1/psicometria/baremo-continuo/calibrar/:test_id')
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: 'psychometrics-write', limit: 5, windowMs: 60_000 })
  async runContinuousNormingCalibration(@Req() req: any, @Param('test_id') testId: string) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_WRITE, 'ContinuousNorming', testId);
    return this.continuousNormingService.runContinuousCalibration(testId);
  }

  @ApiOperation({ summary: 'Consultar percentil suavizado continuo mediante interpolación lineal' })
  @Get('api/v1/psicometria/baremo-continuo/percentil')
  async getPercentileContinuous(
    @Req() req: any,
    @Query('testId') testId: string,
    @Query('theta') theta: string,
    @Query('pais') pais?: string,
    @Query('nivelEducativo') nivelEducativo?: string,
    @Query('tipoPuesto') tipoPuesto?: string,
  ) {
    await this.recordPsychometricsAudit(req, AUDIT_ACTIONS.PSYCHOMETRICS_READ, 'ContinuousNorming', testId, {
      theta,
      pais,
      nivelEducativo,
      tipoPuesto,
    });
    const p = await this.continuousNormingService.getPercentileContinuous(
      testId,
      req.user.organizationId,
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

  private recordPsychometricsAudit(
    req: any,
    action: string,
    resourceType: string,
    resourceId?: string | null,
    metadata?: Record<string, any>,
  ) {
    return this.auditService.record({
      organizationId: req.user.organizationId,
      actorUserId: req.user.userId,
      actorType: 'STAFF',
      action,
      resourceType,
      resourceId,
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null,
      userAgent: req.headers?.['user-agent'] || null,
      metadata,
    });
  }
}
