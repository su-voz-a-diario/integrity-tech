import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class LtiService {
  private readonly logger = new Logger(LtiService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida sintácticamente el id_token (JWT) del LMS.
   * En producción verifica la firma usando la clave pública JWKS del emisor.
   */
  async validateIdToken(idToken: string): Promise<any> {
    if (!idToken) {
      throw new BadRequestException('Falta el token de identidad LTI (id_token).');
    }

    this.logger.log('Decodificando y validando token LTI v1.3...');
    
    // MOCK: En producción, se utiliza 'jsonwebtoken' y 'jwks-rsa' para decodificar
    // y validar la firma criptográfica asimétrica usando las claves del LMS.
    const mockClaims = {
      iss: 'https://moodle.example.com',
      sub: 'lms-user-student-789',
      aud: 'integrity-tech-client-id-001',
      name: 'Sofía Estudiante LMS',
      email: 'sofia.student@lms.com',
      'https://purl.imsglobal.org/spec/lti/claim/roles': [
        'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'
      ],
      'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
        id: 'lms-resource-link-456',
        title: 'Examen de Honestidad Psicometrica'
      },
      'https://purl.imsglobal.org/spec/lti-ags/claim/ltiservicegradeservice': {
        lineitem: 'https://moodle.example.com/api/v1/courses/10/lineitems/12',
        scope: [
          'https://purl.imsglobal.org/spec/lti-ags/scope/score'
        ]
      }
    };

    return mockClaims;
  }

  /**
   * Auto-provisiona al estudiante en nuestro módulo IAM (Just-In-Time Provisioning).
   */
  async provisionUser(claims: any): Promise<any> {
    this.logger.log(`Proporcionando usuario JIT en IAM para el sub: ${claims.sub}`);

    // Buscamos si existe el usuario por su referencia externa (iss + sub) o email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: claims.email },
          // En producción buscaríamos en una tabla de identidades vinculadas
        ]
      }
    });

    if (!user) {
      this.logger.log(`Usuario no encontrado. Creando nuevo registro JIT para: ${claims.name}`);
      let org = await this.prisma.organization.findFirst();
      if (!org) {
        org = await this.prisma.organization.create({
          data: {
            name: 'Organización LTI Demo',
            slug: 'lti-demo',
          }
        });
      }

      const nameParts = (claims.name || 'Estudiante LTI').split(' ');
      const firstName = nameParts[0] || 'Estudiante';
      const lastName = nameParts.slice(1).join(' ') || 'LTI';

      user = await this.prisma.user.create({
        data: {
          organizationId: org.id,
          email: claims.email,
          firstName,
          lastName,
          passwordHash: 'LTI_FEDERATED_AUTHENTICATION_NO_PASSWORD',
        }
      });
    }

    return user;
  }

  /**
   * Resuelve el enlace de recurso del LMS a un examen local de nuestra base de datos.
   */
  async resolveExamFromResourceLink(resourceLinkId: string): Promise<any> {
    // Buscamos si hay un examen enlazado a este recurso LTI
    // Si no lo hay, para la demo obtenemos el primer examen existente
    let exam = await this.prisma.exam.findFirst();

    if (!exam) {
      this.logger.warn('No hay exámenes registrados en la base de datos local. Creando examen por defecto para el launch LTI...');
      // Creamos una organización ficticia para el examen
      const org = await this.prisma.organization.create({
        data: {
          name: 'Organización LTI Demo',
          slug: 'lti-demo-' + Date.now()
        }
      });

      exam = await this.prisma.exam.create({
        data: {
          title: 'Evaluación Psicométrica Likert LTI',
          organizationId: org.id,
          durationMinutes: 45,
          createdBy: '00000000-0000-0000-0000-000000000000'
        }
      });
    }

    return exam;
  }

  /**
   * Inicializa el ExamAttempt y guarda el mapeo LTI para el posterior envío de notas.
   */
  async initializeLtiAttempt(userId: string, examId: string, claims: any): Promise<any> {
    this.logger.log(`Inicializando intento LTI para el usuario ${userId} y examen ${examId}`);

    const agsClaim = claims['https://purl.imsglobal.org/spec/lti-ags/claim/ltiservicegradeservice'];
    const lineitemUrl = agsClaim?.lineitem || 'https://moodle.example.com/api/v1/scores';

    return await this.prisma.$transaction(async (tx) => {
      // 1. Crear el intento de examen local
      const attempt = await tx.examAttempt.create({
        data: {
          examId,
          userId,
          status: 'IN_PROGRESS',
        }
      });

      // 2. Guardar el mapeo LTI para consolidación de notas
      await tx.ltiAttemptMapping.create({
        data: {
          attemptId: attempt.id,
          lmsUserId: claims.sub,
          lineitemUrl,
          iss: claims.iss,
        }
      });

      return attempt;
    });
  }

  /**
   * Genera una sesión JWT local válida para que el estudiante acceda a la app.
   */
  generateSessionToken(userId: string): string {
    // En producción se firma con la clave privada de Integrity-Tech
    return `lti-session-token-jwt-for-user-${userId}`;
  }
}
