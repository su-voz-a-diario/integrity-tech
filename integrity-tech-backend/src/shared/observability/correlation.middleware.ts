import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { RequestContextService } from './request-context.service';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContextService) {}

  use(req: any, res: any, next: () => void) {
    const incomingRequestId = this.firstHeader(req.headers['x-request-id']);
    const requestId = incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId) ? incomingRequestId : randomUUID();
    const activeTraceId = trace.getActiveSpan()?.spanContext().traceId;
    const incomingTraceId = this.firstHeader(req.headers['x-trace-id']);
    const traceId = activeTraceId || (incomingTraceId && REQUEST_ID_PATTERN.test(incomingTraceId) ? incomingTraceId : randomUUID());

    res.setHeader('x-request-id', requestId);
    res.setHeader('x-trace-id', traceId);

    this.context.run(
      {
        traceId,
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      },
      next,
    );
  }

  private firstHeader(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
  }
}
