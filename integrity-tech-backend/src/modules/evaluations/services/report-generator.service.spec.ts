import { NotFoundException } from '@nestjs/common';
import { ReportGeneratorService } from './report-generator.service';

describe('ReportGeneratorService tenant isolation', () => {
  const prisma = {
    examAttempt: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
  } as any;

  let service: ReportGeneratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportGeneratorService(prisma);
  });

  it('loads narrative report attempt inside the current organization only', async () => {
    prisma.examAttempt.findFirst.mockResolvedValue({
      id: 'attempt-a',
      organizationId: 'org-a',
      userId: 'user-a',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      score: 82,
      resultadosTest: [],
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-a',
      organizationId: 'org-a',
      firstName: 'Ana',
      lastName: 'Tenant',
      email: 'ana@example.test',
    });

    const report = await service.generateNarrativeReport('attempt-a', 'org-a');

    expect(report).toContain('Reporte Psicométrico');
    expect(prisma.examAttempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'attempt-a', organizationId: 'org-a' } }),
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-a', organizationId: 'org-a' } }),
    );
  });

  it('returns 404 when the attempt is not available in the tenant', async () => {
    prisma.examAttempt.findFirst.mockResolvedValue(null);

    await expect(service.generateNarrativeReport('attempt-b', 'org-a'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
