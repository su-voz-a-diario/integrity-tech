import { Test, TestingModule } from '@nestjs/testing';
import { ThetaCalculatorService } from './theta-calculator.service';
import { IgaCalculatorService } from './iga-calculator.service';
import { PrismaService } from '../../../shared/database/prisma.service';

describe('Integrity Tech - Integración Psicométrica IRT e IGA (Ciclo Completo)', () => {
  let thetaService: ThetaCalculatorService;
  let igaService: IgaCalculatorService;
  let prisma: PrismaService;

  // Mock de la base de datos completo para simular tablas y relaciones
  const dbMocks = {
    parametrosItems: {
      findMany: jest.fn(),
    },
    examAttempt: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    perfilPuesto: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    resultadoTest: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
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
        {
          provide: PrismaService,
          useValue: dbMocks,
        },
      ],
    }).compile();

    thetaService = module.get<ThetaCalculatorService>(ThetaCalculatorService);
    igaService = module.get<IgaCalculatorService>(IgaCalculatorService);
    prisma = module.get<PrismaService>(PrismaService);
    
    jest.clearAllMocks();
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

    dbMocks.examAttempt.findUnique.mockResolvedValue({
      id: 'attempt-uuid',
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

    // Simular la llamada a la función obtener_baremo_dinamico de PostgreSQL
    dbMocks.$queryRawUnsafe.mockResolvedValue([
      { percentil: 68, n_muestra: 150 }
    ]);

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
});
