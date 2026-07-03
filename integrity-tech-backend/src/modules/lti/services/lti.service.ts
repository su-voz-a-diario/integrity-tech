import { Injectable, Logger, BadRequestException, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { IamFacade } from '../../iam';

@Injectable()
export class LtiService {
  private readonly logger = new Logger(LtiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly iamFacade: IamFacade,
  ) {}

  /**
   * Valida el id_token LTI 1.3 contra configuración real de plataforma LMS.
   */
  async validateIdToken(idToken: string): Promise<any> {
    if (!idToken) {
      throw new BadRequestException('Falta el token de identidad LTI (id_token).');
    }
    throw new NotImplementedException('Validación LTI JWT/JWKS no configurada.');
  }

  /**
   * Auto-provisiona al estudiante LTI cuando exista configuración real de tenant/plataforma.
   */
  async provisionUser(): Promise<any> {
    throw new NotImplementedException('Provisionamiento LTI requiere mapeo real de organización y plataforma LMS.');
  }

  /**
   * Resuelve el enlace de recurso LMS a un examen local cuando exista mapeo real.
   */
  async resolveExamFromResourceLink(): Promise<any> {
    throw new NotImplementedException('Resolución LTI de recurso a examen requiere mapeo persistido real.');
  }

  /**
   * Inicializa intentos LTI únicamente con claims y mapeos reales.
   */
  async initializeLtiAttempt(): Promise<any> {
    throw new NotImplementedException('Inicialización LTI requiere claims y mapeo AGS reales.');
  }

  /**
   * Genera una sesión JWT local válida para que el estudiante acceda a la app.
   */
  async generateSessionToken(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true, email: true },
    });
    if (!user) {
      throw new BadRequestException('Usuario LTI no encontrado para generar sesión.');
    }
    return this.iamFacade.issueSessionToken({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      roles: ['candidate'],
    });
  }
}
