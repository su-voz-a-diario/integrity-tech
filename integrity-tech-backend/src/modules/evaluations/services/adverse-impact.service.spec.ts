import { AdverseImpactService } from './adverse-impact.service';

describe('AdverseImpactService tenant isolation', () => {
  const prisma = {
    resultadoTest: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    parametrosItems: { findMany: jest.fn() },
  } as any;

  let service: AdverseImpactService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdverseImpactService(prisma);
  });

  it('calculates adverse impact using only results and users from the current organization', async () => {
    prisma.resultadoTest.findMany.mockResolvedValue([
      { theta: 0.8, irtCalculated: true, attempt: { userId: 'user-a' } },
      { theta: -0.1, irtCalculated: true, attempt: { userId: 'user-b' } },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-a', pais: 'México' },
      { id: 'user-b', pais: 'Colombia' },
    ]);
    prisma.parametrosItems.findMany.mockResolvedValue([{ itemId: 'item-1' }]);

    await service.calculateAdverseImpact('IT2_AC10', 'org-a');

    expect(prisma.resultadoTest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          testId: 'IT2_AC10',
          irtCalculated: true,
          attempt: { organizationId: 'org-a' },
        },
      }),
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['user-a', 'user-b'] }, organizationId: 'org-a' } }),
    );
    expect(prisma.parametrosItems.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-a', testId: 'IT2_AC10', flagDif: true } }),
    );
  });
});
