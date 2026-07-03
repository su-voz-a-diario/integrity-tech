import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RequestContextService } from './request-context.service';
import { StructuredLoggerService } from './structured-logger.service';

export type OperationalEventType =
  | 'DB_UNAVAILABLE'
  | 'REDIS_UNAVAILABLE'
  | 'QUEUE_STALLED'
  | 'AUDIT_UNAVAILABLE'
  | 'STORAGE_UNAVAILABLE';

@Injectable()
export class OperationalEventPublisher {
  constructor(
    private readonly events: EventEmitter2,
    private readonly context: RequestContextService,
    private readonly logger: StructuredLoggerService,
  ) {}

  publish(type: OperationalEventType, metadata: Record<string, unknown> = {}) {
    const context = this.context.get();
    const event = {
      type,
      severity: 'critical',
      traceId: context?.traceId || null,
      requestId: context?.requestId || null,
      occurredAt: new Date().toISOString(),
      metadata: this.redact(metadata),
    };
    this.events.emit('operational.critical', event);
    this.logger.warn(JSON.stringify(event), 'OperationalEventPublisher');
  }

  private redact(metadata: Record<string, unknown>) {
    const blocked = new Set(['password', 'refreshToken', 'token', 'scoringKeyJson', 'response']);
    return Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, blocked.has(key) ? '[REDACTED]' : value]));
  }
}
