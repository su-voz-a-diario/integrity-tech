import { Test, TestingModule } from '@nestjs/testing';
import { CatService } from './cat.service';
import { ItemSelectorService } from './item-selector.service';
import { ThetaEstimatorService } from './theta-estimator.service';
import { PrismaService } from '../../../shared/database/prisma.service';

describe('CatService (CAT Adaptativo Unit Tests)', () => {
  let service: CatService;
  let prisma: PrismaService;

  const mockPrismaService = {
    catConfig: {
      findFirst: jest.fn(),
    },
    catSession: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    catItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    catItemExposure: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    catResponse: {
      create: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatService,
        ItemSelectorService,
        ThetaEstimatorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CatService>(CatService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('debe iniciar sesión CAT y seleccionar el primer ítem correctamente', async () => {
    const configId = 'config-123';
    const userId = 'user-456';
    const orgId = 'org-789';

    mockPrismaService.catConfig.findFirst.mockResolvedValue({
      id: configId,
      bankId: 'bank-111',
      organizationId: orgId,
      firstItemMethod: 'PRIOR_MEDIUM',
      exposureControl: false,
    });

    mockPrismaService.catItem.findMany.mockResolvedValue([
      { id: 'item-1', bankId: 'bank-111', itemCode: 'I1', type: 'cognitive', difficulty: 0.0, discrimination: 1.5, guessing: 0.0, content: {}, isActive: true },
      { id: 'item-2', bankId: 'bank-111', itemCode: 'I2', type: 'cognitive', difficulty: 1.0, discrimination: 1.0, guessing: 0.0, content: {}, isActive: true },
    ]);

    mockPrismaService.catSession.create.mockResolvedValue({
      id: 'session-999',
      userId,
      bankId: 'bank-111',
      configId,
      status: 'IN_PROGRESS',
      currentItemId: 'item-1',
    });

    const session = await service.startSession(configId, userId, orgId);

    expect(session).toBeDefined();
    expect(session.id).toBe('session-999');
    expect(session.firstItem.id).toBe('item-1'); // Mayor discriminación
  });

  it('debe procesar respuesta del reactivo adaptativo activo y actualizar el estado', async () => {
    const sessionId = 'session-999';
    const orgId = 'org-789';
    const itemId = 'item-1';

    mockPrismaService.catSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId: 'user-456',
      bankId: 'bank-111',
      configId: 'config-123',
      status: 'IN_PROGRESS',
      currentItemId: itemId,
      startTime: new Date(),
      responses: [],
      config: {
        id: 'config-123',
        bankId: 'bank-111',
        organizationId: orgId,
        minItems: 5,
        maxItems: 15,
        stoppingSe: 0.35,
        exposureControl: false,
        rapidGuessingThresholdMs: 2000,
      },
    });

    mockPrismaService.catItem.findUnique.mockResolvedValue({
      id: itemId,
      itemCode: 'I1',
      type: 'cognitive',
      difficulty: 0.0,
      discrimination: 1.5,
      guessing: 0.0,
      content: { correctAnswer: 'A' },
      isActive: true,
    });

    mockPrismaService.catItem.findMany.mockResolvedValue([
      { id: 'item-2', bankId: 'bank-111', itemCode: 'I2', type: 'cognitive', difficulty: 1.0, discrimination: 1.0, guessing: 0.0, content: {}, isActive: true },
    ]);

    const result = await service.processResponse(sessionId, orgId, itemId, 'A', 3500);

    expect(result.completed).toBe(false);
    expect(result.nextItem).toBeDefined();
    expect(result.nextItem!.id).toBe('item-2');
  });

  it('debe rechazar respuesta si el reactivo no coincide con el activo (Vulnerabilidad Mitigada)', async () => {
    const sessionId = 'session-999';
    const orgId = 'org-789';

    mockPrismaService.catSession.findUnique.mockResolvedValue({
      id: sessionId,
      currentItemId: 'item-1',
      status: 'IN_PROGRESS',
      responses: [],
      config: {},
    });

    // Se intenta responder al item-99 en lugar del activo (item-1)
    await expect(service.processResponse(sessionId, orgId, 'item-99', 'A', 3500))
      .rejects.toThrow('El reactivo enviado no coincide con el reactivo activo de la sesión.');
  });
});
