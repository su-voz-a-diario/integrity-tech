import { NotFoundException } from '@nestjs/common';
import { ItemSelectorService } from './item-selector.service';

describe('ItemSelectorService tenant isolation', () => {
  let prisma: any;
  let service: ItemSelectorService;

  beforeEach(() => {
    prisma = {
      catItem: {
        findMany: jest.fn(),
      },
      catItemExposure: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new ItemSelectorService(prisma);
  });

  it('filtra ítems por bankId y organizationId del banco', async () => {
    prisma.catItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        bankId: 'bank-1',
        difficulty: 0,
        discrimination: 1.5,
        guessing: 0,
        isActive: true,
      },
    ]);

    const item = await service.selectNextItem('bank-1', 'org-1', 0, [], false, 0.5);

    expect(item.id).toBe('item-1');
    expect(prisma.catItem.findMany).toHaveBeenCalledWith({
      where: {
        bankId: 'bank-1',
        bank: { organizationId: 'org-1' },
        isActive: true,
        id: { notIn: [] },
      },
    });
  });

  it('no devuelve ítems cuando el bankId pertenece a otro tenant', async () => {
    prisma.catItem.findMany.mockResolvedValue([]);

    await expect(service.selectNextItem('bank-other-tenant', 'org-1', 0, [], false, 0.5))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.catItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bankId: 'bank-other-tenant',
          bank: { organizationId: 'org-1' },
        }),
      }),
    );
  });
});
