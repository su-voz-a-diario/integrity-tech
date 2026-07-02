import { Test, TestingModule } from '@nestjs/testing';
import { ThetaCalculatorService } from './theta-calculator.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { RapidGuessingService } from './rapid-guessing.service';

describe('ThetaCalculatorService (Unit Tests)', () => {
  let service: ThetaCalculatorService;
  let prisma: PrismaService;

  const mockPrismaService = {
    parametrosItems: {
      findMany: jest.fn(),
    },
    question: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThetaCalculatorService,
        RapidGuessingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ThetaCalculatorService>(ThetaCalculatorService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
    mockPrismaService.question.findMany.mockResolvedValue([
      { id: 'Q1', type: 'verbal' },
      { id: 'Q2', type: 'verbal' },
      { id: 'Q3', type: 'verbal' },
    ]);
  });

  it('Debe estimar theta correctamente para ítems dicotómicos 2PL y calcular escalas T-score/CI', async () => {
    // 1. Setup mocks
    mockPrismaService.parametrosItems.findMany.mockResolvedValue([
      { itemId: 'Q1', modelo: '2PL', parametroA: 1.5, parametroB: -1.0, activo: true },
      { itemId: 'Q2', modelo: '2PL', parametroA: 1.0, parametroB: 0.0, activo: true },
      { itemId: 'Q3', modelo: '2PL', parametroA: 1.8, parametroB: 1.0, activo: true },
    ]);

    const respuestas = [
      { itemId: 'Q1', response: 1 },
      { itemId: 'Q2', response: 1 },
      { itemId: 'Q3', response: 1 },
    ];

    // 2. Ejecutar
    const result = await service.calcularTheta('IT2_AC10', respuestas);

    // 3. Aserciones
    expect(result.theta).toBeGreaterThan(0.0);
    expect(result.error).toBeLessThan(1.0);
    expect(result.thetaT).toBe(Math.round((50.0 + 10.0 * result.theta) * 1000) / 1000);
    expect(result.thetaCi).toBe(Math.round((100.0 + 15.0 * result.theta) * 1000) / 1000);
  });

  it('Debe ignorar ítems inactivos (activo: false)', async () => {
    mockPrismaService.parametrosItems.findMany.mockResolvedValue([
      { itemId: 'Q1', modelo: '2PL', parametroA: 1.5, parametroB: -1.0, activo: true },
      { itemId: 'Q2', modelo: '2PL', parametroA: 1.0, parametroB: 0.0, activo: false },
      { itemId: 'Q3', modelo: '2PL', parametroA: 1.8, parametroB: 1.0, activo: false },
    ]);

    (service as any).parameterCache.clear();

    const respuestas = [
      { itemId: 'Q1', response: 1 },
      { itemId: 'Q2', response: 1 },
      { itemId: 'Q3', response: 1 },
    ];

    const result = await service.calcularTheta('IT2_AC10', respuestas);
    expect(result.theta).toBeDefined();
  });

  it('Debe calcular la curva de información del test (TIF) y fiabilidad marginal', async () => {
    mockPrismaService.parametrosItems.findMany.mockResolvedValue([
      { itemId: 'Q1', modelo: '2PL', parametroA: 1.5, parametroB: -1.0, activo: true },
      { itemId: 'Q2', modelo: '2PL', parametroA: 1.0, parametroB: 0.0, activo: true },
    ]);

    const info = await service.getTestInformation('IT2_AC10');
    expect(info.length).toBe(61);
    expect(info[0].theta).toBe(-3.0);
    expect(info[0].information).toBeDefined();

    const reliability = await service.computeMarginalReliability('IT2_AC10');
    expect(reliability).toBeGreaterThanOrEqual(0.0);
    expect(reliability).toBeLessThanOrEqual(1.0);
  });

  it('Debe estimar theta correctamente para ítems politómicos GRM', async () => {
    mockPrismaService.parametrosItems.findMany.mockResolvedValue([
      {
        itemId: 'Q1',
        modelo: 'GRM',
        parametroA: 1.4,
        parametroC1: -2.0,
        parametroC2: -1.0,
        parametroC3: 0.5,
        parametroC4: 1.8,
        activo: true,
      },
      {
        itemId: 'Q2',
        modelo: 'GRM',
        parametroA: 1.1,
        parametroC1: -1.8,
        parametroC2: -0.5,
        parametroC3: 0.8,
        parametroC4: 2.0,
        activo: true,
      },
    ]);

    const respuestas = [
      { itemId: 'Q1', response: 4 },
      { itemId: 'Q2', response: 4 },
    ];

    const result = await service.calcularTheta('IT2_I', respuestas);

    expect(result.theta).toBeGreaterThan(1.0);
    expect(result.error).toBeDefined();
  });

  it('Debe usar fallback (theta=0, error=1, thetaT=50, thetaCi=100) si no hay parámetros', async () => {
    mockPrismaService.parametrosItems.findMany.mockResolvedValue([]);

    const result = await service.calcularTheta('IT2_AC10', [
      { itemId: 'Q1', response: 1 },
    ]);

    expect(result.theta).toBe(0.0);
    expect(result.error).toBe(1.0);
    expect(result.thetaT).toBe(50.0);
    expect(result.thetaCi).toBe(100.0);
  });
});
