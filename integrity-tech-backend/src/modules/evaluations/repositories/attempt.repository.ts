import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class AttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAttemptInTenant(attemptId: string, organizationId: string, include?: any) {
    return this.prisma.examAttempt.findFirst({
      where: { id: attemptId, organizationId },
      ...(include ? { include } : {}),
    });
  }

  listAttemptsForTenant(organizationId: string) {
    return this.prisma.examAttempt.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        logs: {
          select: { riskLevel: true },
        },
      },
    });
  }

  updateFeedback(attemptId: string, npsScore?: number, feedbackText?: string) {
    return this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        npsScore,
        feedbackText,
      },
    });
  }

  markSubmitted(attemptId: string) {
    return this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
  }

  findUserInTenant(userId: string, organizationId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { firstName: true, lastName: true, email: true },
    });
  }

  findExamInTenant(examId: string, organizationId: string) {
    return this.prisma.exam.findFirst({
      where: { id: examId, organizationId },
      select: { id: true, title: true, durationMinutes: true },
    });
  }
}
