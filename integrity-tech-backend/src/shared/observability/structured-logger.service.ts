import { Injectable, LoggerService } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

type LogSeverity = 'debug' | 'info' | 'warn' | 'error';

@Injectable()
export class StructuredLoggerService implements LoggerService {
  constructor(private readonly context: RequestContextService) {}

  log(message: any, module?: string) {
    this.write('info', message, module);
  }

  error(message: any, trace?: string, module?: string) {
    this.write('error', message, module, { error: this.redact(trace) });
  }

  warn(message: any, module?: string) {
    this.write('warn', message, module);
  }

  debug(message: any, module?: string) {
    if (process.env.LOG_LEVEL !== 'debug') return;
    this.write('debug', message, module);
  }

  verbose(message: any, module?: string) {
    this.debug(message, module);
  }

  info(input: {
    module: string;
    action: string;
    message?: string;
    organizationId?: string | null;
    userId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    this.write('info', input.message || input.action, input.module, input);
  }

  private write(severity: LogSeverity, message: any, module?: string, extra: Record<string, unknown> = {}) {
    const ctx = this.context.get();
    const gcpSeverities: Record<LogSeverity, string> = {
      debug: 'DEBUG',
      info: 'INFO',
      warn: 'WARNING',
      error: 'ERROR',
    };
    const payload = {
      timestamp: new Date().toISOString(),
      traceId: ctx?.traceId || null,
      requestId: ctx?.requestId || null,
      organizationId: (extra.organizationId as string) || ctx?.organizationId || null,
      userId: (extra.userId as string) || ctx?.userId || null,
      module: module || (extra.module as string) || 'Application',
      action: (extra.action as string) || 'log',
      severity: gcpSeverities[severity],
      message: this.redact(message),
      metadata: this.redactObject((extra.metadata as Record<string, unknown>) || {}),
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }

  private redact(value: any): any {
    if (typeof value !== 'string') return value;
    return value
      .replace(/(password|refreshToken|refresh_token|token|scoringKey|scoring_key)=([^&\s]+)/gi, '$1=[REDACTED]')
      .slice(0, 2000);
  }

  private redactObject(input: Record<string, unknown>) {
    const blocked = new Set(['password', 'refreshToken', 'refresh_token', 'scoringKeyJson', 'response', 'answers']);
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, blocked.has(key) ? '[REDACTED]' : this.redact(value)]),
    );
  }
}
