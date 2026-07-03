import { Test, TestingModule } from '@nestjs/testing';
import { ThetaCalculatorService } from './theta-calculator.service';
import { IgaCalculatorService } from './iga-calculator.service';
import { PersonFitService } from './person-fit.service';
import { CatService } from './cat.service';
import { ItemSelectorService } from './item-selector.service';
import { ThetaEstimatorService } from './theta-estimator.service';
import { ReportGeneratorService } from './report-generator.service';
import { AdverseImpactService } from './adverse-impact.service';
import { RoiService } from './roi.service';
import { ContinuousNormingService } from './continuous-norming.service';
import { RapidGuessingService } from './rapid-guessing.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ScientificTraceService } from '../../psychometric-governance/services/scientific-trace.service';
import { EvaluationGovernanceResolverService } from '../../psychometric-governance/services/evaluation-governance-resolver.service';

describe('Integrity Tech - Integración Psicométrica IRT e IGA (Ciclo Completo)', () => {
  let thetaService: ThetaCalculatorService;
  let igaService: IgaCalculatorService;
  let personFitService: PersonFitService;
  let catService: CatService;
  let itemSelectorService: ItemSelectorService;
  let reportService: ReportGeneratorService;
  let adverseService: AdverseImpactService;
  let roiService: RoiService;
  let continuousNormingService: ContinuousNormingService;
  let rapidGuessingService: RapidGuessingService;
  let prisma: PrismaService;

  // Mock de la base de datos completo para simular tablas y relaciones
  const dbMocks = {
    parametrosItems: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    baremosDinamicos: {
      findFirst: jest.fn(),
    },
    examAttempt: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    question: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    perfilPuesto: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    resultadoTest: {
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    continuousNorm: {
      findFirst: jest.fn(),
    },
    catConfig: {
      findFirst: jest.fn(),
    },
    catItem: {
      findMany: jest.fn(),
    },
    equatingCoefficients: {
      findFirst: jest.fn(),
    },
    resultadoGlobal: {
      upsert: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThetaCalculatorService,
        IgaCalculatorService,
        PersonFitService,
        CatService,
        ItemSelectorService,
        ThetaEstimatorService,
        ReportGeneratorService,
        AdverseImpactService,
        RoiService,
        ContinuousNormingService,
        RapidGuessingService,
        {
          provide: PrismaService,
          useValue: dbMocks,
        },
        {
          provide: ScientificTraceService,
          useValue: {
            attachTraceToResults: jest.fn().mockResolvedValue({
              mode: 'LEGACY_UNVERSIONED',
              itemVersionIds: [],
              generatedAt: new Date().toISOString(),
            }),
          },
        },
        {
          provide: EvaluationGovernanceResolverService,
          useValue: {
            resolvePublishedResultVersions: jest.fn().mockResolvedValue({
              scoringModelVersionId: null,
              normGroupVersionId: null,
              reportTemplateVersionId: null,
            }),
          },
        },
      ],
    }).compile();

    thetaService = module.get<ThetaCalculatorService>(ThetaCalculatorService);
    igaService = module.get<IgaCalculatorService>(IgaCalculatorService);
    personFitService = module.get<PersonFitService>(PersonFitService);
    catService = module.get<CatService>(CatService);
    itemSelectorService = module.get<ItemSelectorService>(ItemSelectorService);
    reportService = module.get<ReportGeneratorService>(ReportGeneratorService);
    adverseService = module.get<AdverseImpactService>(AdverseImpactService);
    roiService = module.get<RoiService>(RoiService);
    continuousNormingService = module.get<ContinuousNormingService>(ContinuousNormingService);
    rapidGuessingService = module.get<RapidGuessingService>(RapidGuessingService);
    prisma = module.get<PrismaService>(PrismaService);
    
    jest.clearAllMocks();
    dbMocks.question.findMany.mockResolvedValue([
      { id: 'Q1', type: 'verbal' },
      { id: 'Q2', type: 'verbal' },
      { id: 'Q3', type: 'verbal' },
    ]);
    dbMocks.equatingCoefficients.findFirst.mockResolvedValue(null);
    dbMocks.baremosDinamicos.findFirst.mockResolvedValue(null);
    dbMocks.resultadoTest.updateMany.mockResolvedValue({ count: 0 });
    dbMocks.catConfig.findFirst.mockResolvedValue({
      id: 'cat-config-ac10',
      bankId: 'cat-bank-ac10',
      organizationId: 'org-uuid',
      minItems: 10,
      maxItems: 30,
      stoppingSe: 0.35,
      exposureControl: false,
      maxExposureRate: 0.5,
      bank: {
        id: 'cat-bank-ac10',
        name: 'IT2_AC10',
      },
    });
    dbMocks.catItem.findMany.mockResolvedValue([
      {
        id: 'Q2',
        bankId: 'cat-bank-ac10',
        itemCode: 'Q2',
        type: 'cognitive',
        difficulty: 0.5,
        discrimination: 1.2,
        guessing: 0,
        content: { text: 'Reactivo CAT Q2' },
        isActive: true,
      },
    ]);
  });

  it('Debe simular estimación de theta ignorando ítems omitidos y calculando IGA dinámico', async () => {
    // 1. Configurar parámetros simulados para IT2_AC10 (dificultad b, discriminación a)
    dbMocks.parametrosItems.findMany.mockResolvedValue([
      { itemId: 'Q1', modelo: '2PL', parametroA: 1.5, parametroB: -0.5 },
      { itemId: 'Q2', modelo: '2PL', parametroA: 1.2, parametroB: 0.5 },
      { itemId: 'Q3', modelo: '2PL', parametroA: 1.8, parametroB: 1.5 },
    ]);

    // 2. Patrón de respuestas con valor omitido (null) en Q3
    const respuestas = [
      { itemId: 'Q1', response: 1 }, // correcto
      { itemId: 'Q2', response: 0 }, // incorrecto
      { itemId: 'Q3', response: null }, // omitido (debe ser ignorado en lugar de penalizado)
    ];

    // Estimar theta
    const estimation = await thetaService.calcularTheta('IT2_AC10', respuestas);
    expect(estimation.theta).toBeDefined();
    expect(estimation.error).toBeDefined();

    // 3. Simular búsqueda en IgaCalculatorService usando baremos dinámicos
    // Configurar perfil de puesto (Gerente Comercial)
    dbMocks.perfilPuesto.findUnique.mockResolvedValue({
      id: 'perfil-123',
      nombre: 'Gerente Comercial',
      wIntegridad: 0.50,
      wPersonalidad: 0.00,
      wCognitivo: 0.50,
      wCompetencias: 0.00,
    });
    dbMocks.perfilPuesto.findFirst.mockResolvedValue({
      id: 'perfil-123',
      nombre: 'Gerente Comercial',
      wIntegridad: 0.50,
      wPersonalidad: 0.00,
      wCognitivo: 0.50,
      wCompetencias: 0.00,
    });

    dbMocks.examAttempt.findUnique.mockResolvedValue({
      id: 'attempt-uuid',
      organizationId: 'org-uuid',
      userId: 'user-uuid',
      scoreDetails: null,
    });

    dbMocks.user.findUnique.mockResolvedValue({
      id: 'user-uuid',
      pais: 'Colombia',
      sector: 'Banca',
      nivelEducativo: 'Universitario',
      tipoPuesto: 'Gerente',
    });

    // Resultados de test simulados
    dbMocks.resultadoTest.findMany.mockResolvedValue([
      {
        testId: 'IT2_AC10',
        percentil: 50.0,
        irtCalculated: true,
        theta: estimation.theta,
      },
      {
        testId: 'IT2_I',
        percentil: 80.0,
        irtCalculated: false,
        theta: null,
      }
    ]);

    dbMocks.baremosDinamicos.findFirst.mockResolvedValue({ percentil: 68, nMuestra: 150 });

    // Calcular IGA
    const igaResult = await igaService.calcularIga('attempt-uuid', 'perfil-123');

    // Comprobaciones
    expect(igaResult).toBeDefined();
    // IGA = 0.50 * 80 (Integridad, clásico) + 0.50 * 68 (Cognitivo, dinámico resuelto por $queryRawUnsafe) = 74
    expect(igaResult.iga).toBe(74); 
    expect(igaResult.alertas).toBeDefined();
  });

  it('Debe simular cálculo concurrente de theta (Stress Test)', async () => {
    dbMocks.parametrosItems.findMany.mockResolvedValue([
      { itemId: 'Q1', modelo: '2PL', parametroA: 1.5, parametroB: -0.5, activo: true },
      { itemId: 'Q2', modelo: '2PL', parametroA: 1.2, parametroB: 0.5, activo: true },
    ]);

    const respuestas = [
      { itemId: 'Q1', response: 1 },
      { itemId: 'Q2', response: 0 },
    ];

    // Ejecutar 50 estimaciones concurrentes
    const promises = Array.from({ length: 50 }, () => 
      thetaService.calcularTheta('IT2_AC10', respuestas)
    );

    const start = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - start;

    expect(results.length).toBe(50);
    expect(duration).toBeLessThan(500); // Debe responder en menos de 500ms
    for (const r of results) {
      expect(r.theta).toBeDefined();
      expect(r.thetaT).toBeDefined();
      expect(r.thetaCi).toBeDefined();
    }
  });

  it('Debe validar todos los módulos avanzados (Person-Fit, CAT, Adverse Impact, NLG, ROI)', async () => {
    // 1. Person-Fit
    dbMocks.parametrosItems.findMany.mockResolvedValue([
      { itemId: 'Q1', modelo: '2PL', parametroA: 1.5, parametroB: -0.5, activo: true },
      { itemId: 'Q2', modelo: '2PL', parametroA: 1.2, parametroB: 0.5, activo: true },
    ]);
    const lzResult = await personFitService.calculatePersonFit('IT2_AC10', [
      { itemId: 'Q1', response: 1 },
      { itemId: 'Q2', response: 0 },
    ], 0.5);
    expect(lzResult.lz).toBeDefined();
    expect(lzResult.aberrante).toBe(false);

    // 2. CAT
    const catResult = await catService.selectNextItem('IT2_AC10', ['Q1'], 0.5, 0.4);
    expect(catResult.nextItemId).toBe('Q2');
    expect(catResult.shouldStop).toBe(false);

    // 3. NLG Report
    dbMocks.examAttempt.findUnique.mockResolvedValue({
      id: 'attempt-uuid',
      userId: 'user-uuid',
      createdAt: new Date(),
      score: 85.0,
      resultadosTest: [
        { testId: 'IT2_AC10', theta: 0.5, percentil: 75.0, thetaT: 55.0, thetaCi: 107.5, aberrante: false, personFitLz: -0.2 }
      ]
    });
    dbMocks.user.findUnique.mockResolvedValue({
      id: 'user-uuid',
      firstName: 'Ricardo',
      lastName: 'Garcia',
      email: 'ricardo@test.com'
    });
    const nlgReport = await reportService.generateNarrativeReport('attempt-uuid');
    expect(nlgReport).toContain('Reporte Psicométrico');
    expect(nlgReport).toContain('Ricardo');

    // 4. Adverse Impact (80% Rule)
    dbMocks.resultadoTest.findMany.mockResolvedValue([
      {
        theta: 0.5,
        irtCalculated: true,
        attempt: { userId: 'user-1' }
      },
      {
        theta: -0.2,
        irtCalculated: true,
        attempt: { userId: 'user-2' }
      }
    ]);
    dbMocks.user.findMany.mockResolvedValue([
      { id: 'user-1', pais: 'Colombia' },
      { id: 'user-2', pais: 'México' }
    ]);
    const adverseResult = await adverseService.calculateAdverseImpact('IT2_AC10');
    expect(adverseResult.testId).toBe('IT2_AC10');

    // 5. Talent ROI (BCG Model)
    const roiResult = roiService.calculateROI({
      contratacionesAnuales: 10,
      permanenciaMediaAnos: 2,
      coeficienteValidez: 0.35,
      salarioMedioAnual: 30000,
      tasaSeleccion: 0.20,
      costoPorCandidato: 10,
      totalCandidatosEvaluados: 100
    });
    expect(roiResult.utilidadNetaAcumulada).toBeGreaterThan(0);
    expect(roiResult.retornoInversionPorcentaje).toBeGreaterThan(0);

    // 6. Continuous Norming (GAMLSS)
    dbMocks.continuousNorm.findFirst.mockResolvedValue({
      id: 'norm-uuid',
      testId: 'IT2_AC10',
      pais: 'Colombia',
      nivelEducativo: 'Universitario',
      tipoPuesto: 'Gerente',
      p5: -1.5,
      p10: -1.0,
      p25: -0.5,
      p50: 0.0,
      p75: 0.5,
      p90: 1.0,
      p95: 1.5
    });

    const normPercentile = await continuousNormingService.getPercentileContinuous(
      'IT2_AC10',
      0.25,
      'Colombia',
      'Universitario',
      'Gerente'
    );
    expect(normPercentile).toBeDefined();
    expect(normPercentile).toBeGreaterThan(50); // Dado que theta = 0.25 > p50 = 0.0, el percentil debe ser > 50

    // 7. Rapid Guessing (Effort-Moderated EAP)
    dbMocks.parametrosItems.findMany.mockResolvedValue([
      { itemId: 'Q1', modelo: '2PL', parametroA: 1.5, parametroB: -0.5, activo: true },
      { itemId: 'Q2', modelo: '2PL', parametroA: 1.2, parametroB: 0.5, activo: true },
      { itemId: 'Q3', modelo: '2PL', parametroA: 1.8, parametroB: 1.5, activo: true },
    ]);
    (thetaService as any).parameterCache.clear();

    const respuestasRapidas = [
      { itemId: 'Q1', response: 1, tiempoMs: 4000 },  // solución (umbral = 3000ms para verbal)
      { itemId: 'Q2', response: 0, tiempoMs: 500 },   // guessing (< 2500ms para numerico/verbal)
      { itemId: 'Q3', response: 1, tiempoMs: 4500 },  // solución
    ];
    const estRapida = await thetaService.calcularTheta('IT2_AC10', respuestasRapidas);
    expect(estRapida.engagement).toBeLessThan(1.0);
    expect(estRapida.engagement).toBeCloseTo(0.6667, 2); // 2 de 3 son solution -> ~0.67 engagement
  });
});
