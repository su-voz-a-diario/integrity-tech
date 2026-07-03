import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpRequests: Counter<string>;
  readonly httpDuration: Histogram<string>;
  readonly domainEvents: Counter<string>;
  readonly queueJobs: Counter<string>;
  readonly dbQueries: Counter<string>;
  readonly dbQueryDuration: Histogram<string>;
  readonly dependencyHealth: Gauge<string>;
  readonly auditEvents: Counter<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'integrity_' });

    this.httpRequests = new Counter({
      name: 'integrity_http_requests_total',
      help: 'HTTP requests by method, route and status.',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpDuration = new Histogram({
      name: 'integrity_http_request_duration_seconds',
      help: 'HTTP request latency.',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.domainEvents = new Counter({
      name: 'integrity_domain_events_total',
      help: 'Business-safe operational domain events.',
      labelNames: ['module', 'action', 'status'],
      registers: [this.registry],
    });

    this.queueJobs = new Counter({
      name: 'integrity_queue_jobs_total',
      help: 'Queue jobs by queue and status.',
      labelNames: ['queue', 'job', 'status'],
      registers: [this.registry],
    });

    this.dbQueries = new Counter({
      name: 'integrity_db_queries_total',
      help: 'Database query count.',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: 'integrity_db_query_duration_seconds',
      help: 'Database query duration.',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
      registers: [this.registry],
    });

    this.dependencyHealth = new Gauge({
      name: 'integrity_dependency_health',
      help: 'Dependency health status, 1 healthy and 0 unhealthy.',
      labelNames: ['dependency'],
      registers: [this.registry],
    });

    this.auditEvents = new Counter({
      name: 'integrity_audit_events_total',
      help: 'Audit events written by action and status.',
      labelNames: ['action', 'status'],
      registers: [this.registry],
    });
  }

  recordHttp(method: string, route: string, status: number, durationSeconds: number) {
    const labels = { method, route: this.normalizeRoute(route), status: String(status) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, durationSeconds);
  }

  recordDomainEvent(module: string, action: string, status = 'success') {
    this.domainEvents.inc({ module, action, status });
  }

  recordQueueJob(queue: string, job: string, status: string) {
    this.queueJobs.inc({ queue, job, status });
  }

  recordDbQuery(query: string, durationMs: number) {
    const operation = query.trim().split(/\s+/)[0]?.toUpperCase() || 'UNKNOWN';
    this.dbQueries.inc({ operation });
    this.dbQueryDuration.observe({ operation }, durationMs / 1000);
  }

  setDependencyHealth(dependency: string, healthy: boolean) {
    this.dependencyHealth.set({ dependency }, healthy ? 1 : 0);
  }

  recordAuditEvent(action: string, status: 'success' | 'failure') {
    this.auditEvents.inc({ action, status });
  }

  private normalizeRoute(route: string) {
    return route
      .split('?')[0]
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':uuid')
      .replace(/\/\d+/g, '/:id');
  }
}
