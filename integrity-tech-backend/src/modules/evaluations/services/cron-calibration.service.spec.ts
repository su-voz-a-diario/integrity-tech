import { CronCalibrationService } from './cron-calibration.service';

describe('CronCalibrationService tenant isolation', () => {
  let prisma: any;
  let thetaService: any;
  let service: CronCalibrationService;

  beforeEach(() => {
    prisma = {
      parametrosItems: { findFirst: jest.fn() },
      examAttempt: { count: jest.fn() },
      organization: { findMany: jest.fn() },
      psychometricQualityLog: { create: jest.fn() },
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
    };
    thetaService = {
      clearCache: jest.fn(),
      computeMarginalReliability: jest.fn().mockResolvedValue(0.91),
    };
    service = new CronCalibrationService(prisma, thetaService);
  });

  it('evalúa recalibración usando organizationId en parámetros e intentos', async () => {
    const lastDate = new Date('2026-01-01T00:00:00.000Z');
    prisma.parametrosItems.findFirst.mockResolvedValue({ fechaCalibracion: lastDate });
    prisma.examAttempt.count.mockResolvedValue(0);

    await (service as any).runNocturnalCalibrationForOrganization('org-1');

    expect(prisma.parametrosItems.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      orderBy: { fechaCalibracion: 'desc' },
    });
    expect(prisma.examAttempt.count).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        status: 'COMPLETED',
        submittedAt: { gt: lastDate },
      },
    });
    expect(thetaService.clearCache).not.toHaveBeenCalled();
  });

  it('monitorea calidad psicométrica agrupando por organización', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { organization_id: 'org-1', test_id: 'IT2_AC10', mean_theta: 0.1, sd_theta: 0.8, n: 120 },
      { organization_id: 'org-2', test_id: 'IT2_AC10', mean_theta: -0.2, sd_theta: 0.7, n: 130 },
    ]);

    await service.monitorPsychometricQuality();

    expect(thetaService.computeMarginalReliability).toHaveBeenCalledWith('IT2_AC10', 'org-1');
    expect(thetaService.computeMarginalReliability).toHaveBeenCalledWith('IT2_AC10', 'org-2');
    expect(prisma.psychometricQualityLog.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org-1', testId: 'IT2_AC10' }),
    }));
    expect(prisma.psychometricQualityLog.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org-2', testId: 'IT2_AC10' }),
    }));
  });
});
