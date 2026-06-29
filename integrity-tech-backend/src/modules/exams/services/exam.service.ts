import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { IamFacade } from '../../iam';

@Injectable()
export class ExamService {
  private readonly logger = new Logger(ExamService.name);

  constructor(
    private readonly iamFacade: IamFacade, // Inyección de la Fachada de Identidad (Abstracción)
  ) {}

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

    // 3. Persistir definición del examen (Simulado)
    this.logger.log(`Creando examen "${title}" para la organización: ${user.organizationId}`);
    return {
      id: 'mock-exam-id-1111',
      title,
      description,
      organizationId: user.organizationId,
      createdBy: user.userId,
      createdAt: new Date().toISOString(),
    };
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

    // 3. Validación de la existencia del examen (Simulado)
    if (examId !== 'mock-exam-id-1111') {
      throw new NotFoundException('El examen solicitado no existe o no pertenece a tu organización.');
    }

    // 4. Crear intento (Persistencia simulada)
    this.logger.log(`Registrando intento de examen ${examId} para el alumno: ${user.userId}`);
    return {
      attemptId: 'mock-attempt-id-7777',
      examId,
      userId: user.userId,
      status: 'IN_PROGRESS',
      startedAt: new Date().toISOString(),
    };
  }
}
