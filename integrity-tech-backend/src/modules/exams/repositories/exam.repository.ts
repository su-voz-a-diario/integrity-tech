import { Exam } from '@prisma/client';

export abstract class ExamRepository {
  abstract findById(id: string): Promise<Exam | null>;
  
  abstract create(data: {
    organizationId: string;
    title: string;
    description?: string;
    durationMinutes?: number;
    startTime?: Date;
    endTime?: Date;
    maxAttempts?: number;
    passingScore?: number;
    createdBy: string;
  }): Promise<Exam>;
}
