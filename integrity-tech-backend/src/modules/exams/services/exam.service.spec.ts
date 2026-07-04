import { ExamService } from './exam.service';

describe('ExamService', () => {
  let service: ExamService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      exam: {
        findMany: jest.fn(),
      },
      assessment: {
        findMany: jest.fn(),
      },
    };
    service = new ExamService({} as any, prisma);
  });

  it('lists only published exams with published governance in the same tenant', async () => {
    prisma.exam.findMany.mockResolvedValue([
      { id: 'exam-1', title: 'Integrity', description: 'Real', isPublished: true, organizationId: 'org-1' },
      { id: 'exam-2', title: 'Draft governance', description: null, isPublished: true, organizationId: 'org-1' },
    ]);
    prisma.assessment.findMany.mockResolvedValue([{ id: 'exam-1', code: 'INTEGRITY' }]);

    const result = await service.listPublishedExams('org-1');

    expect(prisma.exam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1', isPublished: true } }),
    );
    expect(prisma.assessment.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        id: { in: ['exam-1', 'exam-2'] },
        versions: { some: { status: 'PUBLISHED' } },
      },
      select: { id: true, code: true },
    });
    expect(result).toEqual([
      expect.objectContaining({ id: 'exam-1', title: 'Integrity', publicationStatus: 'PUBLISHED' }),
    ]);
  });
});
