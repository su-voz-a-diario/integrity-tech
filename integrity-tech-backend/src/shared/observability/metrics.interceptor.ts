import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { catchError, tap, throwError } from 'rxjs';
import { MetricsService } from './metrics.service';
import { RequestContextService } from './request-context.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsService,
    private readonly context: RequestContextService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const http = ctx.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const started = process.hrtime.bigint();

    this.context.merge({
      organizationId: req.user?.organizationId || null,
      userId: req.user?.userId || null,
      method: req.method,
      path: req.originalUrl || req.url,
    });

    return next.handle().pipe(
      tap(() => this.record(req, res.statusCode, started)),
      catchError((error) => {
        this.record(req, error?.status || res.statusCode || 500, started);
        return throwError(() => error);
      }),
    );
  }

  private record(req: any, status: number, started: bigint) {
    const duration = Number(process.hrtime.bigint() - started) / 1_000_000_000;
    this.metrics.recordHttp(req.method, req.route?.path || req.originalUrl || req.url || 'unknown', status, duration);
  }
}
