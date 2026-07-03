import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RequestContextService } from '../observability/request-context.service';
import { StructuredLoggerService } from '../observability/structured-logger.service';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly context?: RequestContextService,
    private readonly structuredLogger?: StructuredLoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = this.resolveStatus(exception);
    const message = this.resolveMessage(exception, status);
    const correlation = this.context?.get();

    void this.recordSecurityEvent(exception, request, status);

    if (status >= 500) {
      if (this.structuredLogger) {
        this.structuredLogger.error(
          `Unhandled error on ${request.method} ${request.originalUrl || request.url}`,
          exception instanceof Error ? exception.stack : String(exception),
          'ApiExceptionFilter',
        );
      } else {
        this.logger.error(
          `Error no controlado en ${request.method} ${request.originalUrl || request.url}`,
          exception instanceof Error ? exception.stack : String(exception),
        );
      }
    }

    response.status(status).json({
      statusCode: status,
      error: this.resolveErrorLabel(status),
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      traceId: correlation?.traceId || null,
      requestId: correlation?.requestId || null,
    });
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return HttpStatus.CONFLICT;
      if (exception.code === 'P2025') return HttpStatus.NOT_FOUND;
      return HttpStatus.BAD_REQUEST;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveMessage(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response && 'message' in response) {
        const rawMessage = (response as any).message;
        if (Array.isArray(rawMessage)) return 'El payload enviado no cumple con las reglas de validación.';
        if (typeof rawMessage === 'string') return rawMessage;
      }
      if (typeof response === 'string') return response;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (status === HttpStatus.CONFLICT) return 'La operación entra en conflicto con el estado actual del recurso.';
      if (status === HttpStatus.NOT_FOUND) return 'El recurso solicitado no está disponible.';
      return 'La solicitud no pudo procesarse correctamente.';
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'Ocurrió un error interno. Intenta nuevamente o contacta soporte.';
    }

    return 'La solicitud no pudo procesarse correctamente.';
  }

  private resolveErrorLabel(status: number): string {
    const labels: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
    };
    return labels[status] || 'Error';
  }

  private async recordSecurityEvent(exception: unknown, request: any, status: number): Promise<void> {
    try {
      if (![400, 401, 403, 429].includes(status)) return;
      const organizationId = request.user?.organizationId;
      const path = request.originalUrl || request.url || '';
      if (!organizationId && !this.isPublicSensitivePath(path)) return;

      await (this.prisma as any).auditEvent.create({
        data: {
          organizationId: organizationId || null,
          actorUserId: request.user?.userId || null,
          actorType: request.user?.roles?.includes?.('candidate') ? 'CANDIDATE' : 'STAFF',
          action: status === 429 ? 'security.rate_limit.exceeded' : 'security.request.rejected',
          resourceType: 'HttpRequest',
          resourceId: null,
          ipAddress: request.ip || request.headers?.['x-forwarded-for'] || null,
          userAgent: request.headers?.['user-agent'] || null,
          metadata: {
            status,
            method: request.method,
            path,
            traceId: this.context?.getTraceId() || null,
            requestId: this.context?.getRequestId() || null,
            exception: exception instanceof HttpException ? exception.constructor.name : 'UnhandledException',
          },
        },
      });
    } catch (error) {
      this.logger.warn(`No se pudo auditar error HTTP ${status}: ${error.message}`);
    }
  }

  private isPublicSensitivePath(path: string): boolean {
    return path.includes('/api/auth/login')
      || path.includes('/api/evaluations/invitations/verify')
      || path.includes('/api/evaluations/invitations/claim');
  }
}
