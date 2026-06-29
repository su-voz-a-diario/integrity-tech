import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ExamRepository } from './exam.repository';
import { Exam } from '@prisma/client';

@Injectable()
export class PrismaExamRepository implements ExamRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Exam | null> {
    return this.prisma.exam.findUnique({
      where: { id },
    });
  }

  async create(data: {
    organizationId: string;
    title: string;
    description?: string;
    durationMinutes?: number;
    startTime?: Date;
    endTime?: Date;
    maxAttempts?: number;
    passingScore?: number;
    createdBy: string;
  }): Promise<Exam> {
    return this.prisma.exam.create({
      data: {
        organizationId: data.organizationId,
        title: data.title,
        description: data.description,
        durationMinutes: data.durationMinutes,
        startTime: data.startTime,
        endTime: data.endTime,
        maxAttempts: data.maxAttempts,
        passingScore: data.passingScore,
        createdBy: data.createdBy,
      },
    });
  }
}
