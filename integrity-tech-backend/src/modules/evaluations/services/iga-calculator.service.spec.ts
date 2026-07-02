import { Test, TestingModule } from '@nestjs/testing';
import { IgaCalculatorService } from './iga-calculator.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ThetaCalculatorService } from './theta-calculator.service';
import { PersonFitService } from './person-fit.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('IgaCalculatorService (Unit Tests)', () => {
  let service: IgaCalculatorService;
  let prisma: PrismaService;

  const mockPrismaService = {
    examAttempt: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    candidateInvitation: {
      findUnique: jest.fn(),
    },
    perfilPuesto: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    resultadoTest: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    resultadoGlobal: {
      upsert: jest.fn(),
    },
  };

  const mockThetaService = {
    calcularTheta: jest.fn(),
  };

  const mockPersonFitService = {
    calculatePersonFit: jest.fn().mockResolvedValue({ lz: 0.0, aberrante: false }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IgaCalculatorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ThetaCalculatorService,
          useValue: mockThetaService,
        },
        {
          provide: PersonFitService,
          useValue: mockPersonFitService,
        },
      ],
    }).compile();

    service = module.get<IgaCalculatorService>(IgaCalculatorService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();

    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 'user-uuid',
      pais: null,
      sector: null,
      nivelEducativo: null,
      tipoPuesto: null,
    });
  });

  it('Debe calcular IGA correctamente con todos los test completados y sin alertas', async () => {
    // 1. Setup mocks
    mockPrismaService.examAttempt.findUnique.mockResolvedValue({
      id: 'attempt-1111',
      status: 'COMPLETED',
      scoreDetails: null,
    });
    mockPrismaService.perfilPuesto.findUnique.mockResolvedValue({
      id: 'profile-2222',
      nombre: 'Gerente Comercial',
      wIntegridad: 0.35,
      wPersonalidad: 0.25,
      wCognitivo: 0.20,
      wCompetencias: 0.20,
    });
    mockPrismaService.resultadoTest.findMany.mockResolvedValue([
      { testId: 'IT2_I', percentil: 80.0 }, // 80.0 * 0.35 = 28
      { testId: 'IT2_P10', percentil: 70.0 }, // 70.0 * 0.25 = 17.5
      { testId: 'IT2_AC10', percentil: 90.0 }, // 90.0 * 0.20 = 18
      { testId: 'IT2_CB10', percentil: 85.0 }, // 85.0 * 0.20 = 17
    ]);
    // IGA = 28 + 17.5 + 18 + 17 = 80.5

    mockPrismaService.resultadoGlobal.upsert.mockResolvedValue({});

    // 2. Ejecutar
    const result = await service.calcularIga('attempt-1111', 'profile-2222');

    // 3. Aserciones
    expect(result.iga).toBe(80.5);
    expect(result.recomendacion).toBe('Recomendado');
    expect(result.alertas.length).toBe(0);
  });

  it('Debe redistribuir pesos si falta una evaluación (ej. Cognitiva)', async () => {
    // 1. Setup mocks
    mockPrismaService.examAttempt.findUnique.mockResolvedValue({
      id: 'attempt-3333',
      status: 'COMPLETED',
    });
    mockPrismaService.perfilPuesto.findUnique.mockResolvedValue({
      id: 'profile-2222',
      nombre: 'Gerente Comercial',
      wIntegridad: 0.40,
      wPersonalidad: 0.30,
      wCognitivo: 0.15, // Peso omitido (no realizado)
      wCompetencias: 0.15,
    });
    // Pesos realizados sum: 0.40 + 0.30 + 0.15 = 0.85 (se escala proporcionalmente)
    mockPrismaService.resultadoTest.findMany.mockResolvedValue([
      { testId: 'IT2_I', percentil: 80.0 }, // 80 * (0.40 / 0.85) = 37.64
      { testId: 'IT2_P10', percentil: 70.0 }, // 70 * (0.30 / 0.85) = 24.70
      { testId: 'IT2_CB10', percentil: 85.0 }, // 85 * (0.15 / 0.85) = 15.00
    ]);
    // IGA = 37.64 + 24.70 + 15 = 77.3

    const result = await service.calcularIga('attempt-3333', 'profile-2222');

    expect(result.iga).toBe(77.4);
    expect(result.recomendacion).toBe('Recomendado');
  });

  it('Debe generar alerta de riesgo ético si el percentil de integridad es inferior a 20', async () => {
    mockPrismaService.examAttempt.findUnique.mockResolvedValue({
      id: 'attempt-4444',
      status: 'COMPLETED',
    });
    mockPrismaService.perfilPuesto.findUnique.mockResolvedValue({
      id: 'profile-2222',
      nombre: 'Gerente Comercial',
      wIntegridad: 0.35,
      wPersonalidad: 0.25,
      wCognitivo: 0.20,
      wCompetencias: 0.20,
    });
    mockPrismaService.resultadoTest.findMany.mockResolvedValue([
      { testId: 'IT2_I', percentil: 18.0 }, // ALERTA: < 20
      { testId: 'IT2_P10', percentil: 70.0 },
      { testId: 'IT2_AC10', percentil: 80.0 },
      { testId: 'IT2_CB10', percentil: 85.0 },
    ]);

    const result = await service.calcularIga('attempt-4444', 'profile-2222');

    expect(result.alertas).toContain('Riesgo ético elevado');
  });
});
