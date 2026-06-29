import { CanActivate, ExecutionContext, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class AttemptOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Usuario inyectado por el JwtAuthGuard previo
    const attemptId = request.params.attemptId;

    if (!user) {
      throw new ForbiddenException('No hay sesión de usuario activa.');
    }

    if (!attemptId) {
      throw new ForbiddenException('Falta el parámetro de ruta "attemptId".');
    }

    // Consultamos la tabla exam_attempts de nuestro propio módulo transaccional
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { userId: true },
    });

    if (!attempt) {
      throw new NotFoundException('El intento de examen especificado no existe.');
    }

    // VALIDACIÓN CRÍTICA DE PROPIEDAD:
    // El ID del usuario logueado debe coincidir con el usuario asignado al intento.
    if (attempt.userId !== user.userId) {
      throw new ForbiddenException('Acceso denegado: Este intento de examen pertenece a otro estudiante.');
    }

    return true;
  }
}
