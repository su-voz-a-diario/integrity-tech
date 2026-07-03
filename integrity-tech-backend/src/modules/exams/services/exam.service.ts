import { BadRequestException, Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { IamFacade } from '../../iam';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class ExamService {
  private readonly logger = new Logger(ExamService.name);

  constructor(
    private readonly iamFacade: IamFacade, // Inyección de la Fachada de Identidad (Abstracción)
    private readonly prisma: PrismaService,
  ) {}


  async listPublishedExams(organizationId: string) {
    const exams = await this.prisma.exam.findMany({
      where: {
        organizationId,
        isPublished: true,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        isPublished: true,
        organizationId: true,
      },
    });

    return exams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      nombre: exam.title,
      description: exam.description,
      descripcion: exam.description,
      publicationStatus: exam.isPublished ? 'PUBLISHED' : 'DRAFT',
      isPublished: exam.isPublished,
      organizationId: exam.organizationId,
    }));
  }

  /**
   * Crea una nueva definición de examen.
   * Requiere permiso 'exam:create'.
   */
  async createExam(token: string, title: string, description: string) {
    // 1. Validar sesión
    const user = await this.iamFacade.validateSession(token);

    // 2. Verificar permisos de rol (RBAC) a través de la fachada
    const hasPermission = await this.iamFacade.verifyUserPermission(user.userId, 'exam:create');
    if (!hasPermission) {
      this.logger.warn(`Usuario ${user.userId} intentó crear examen sin privilegios necesarios.`);
      throw new ForbiddenException('No tienes permiso para crear exámenes en esta organización.');
    }

    const normalizedTitle = title?.trim();
    if (!normalizedTitle) {
      throw new BadRequestException('El título del examen es obligatorio.');
    }

    this.logger.log(`Creando examen "${normalizedTitle}" para la organización: ${user.organizationId}`);
    return this.prisma.exam.create({
      data: {
        organizationId: user.organizationId,
        title: normalizedTitle,
        description: description?.trim() || null,
        createdBy: user.userId,
      },
    });
  }

  /**
   * Registra e inicia un intento de examen para un alumno.
   * Requiere permiso 'exam:attempt'.
   */
  async startExamAttempt(token: string, examId: string) {
    // 1. Validar sesión
    const user = await this.iamFacade.validateSession(token);

    // 2. Verificar permisos de rol (RBAC) a través de la fachada
    const hasPermission = await this.iamFacade.verifyUserPermission(user.userId, 'exam:attempt');
    if (!hasPermission) {
      this.logger.warn(`Usuario ${user.userId} intentó iniciar intento de examen sin permiso.`);
      throw new ForbiddenException('No tienes permisos de estudiante para realizar exámenes.');
    }

    const exam = await this.prisma.exam.findFirst({
      where: {
        id: examId,
        organizationId: user.organizationId,
        isPublished: true,
      },
      select: { id: true, organizationId: true },
    });

    if (!exam) {
      throw new NotFoundException('El examen solicitado no existe, no está publicado o no pertenece a tu organización.');
    }

    this.logger.log(`Registrando intento de examen ${exam.id} para el alumno: ${user.userId}`);
    const attempt = await this.prisma.examAttempt.create({
      data: {
        organizationId: exam.organizationId,
        examId: exam.id,
        userId: user.userId,
        status: 'IN_PROGRESS',
      },
    });

    return {
      attemptId: attempt.id,
      examId: attempt.examId,
      userId: attempt.userId,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
    };
  }
}
