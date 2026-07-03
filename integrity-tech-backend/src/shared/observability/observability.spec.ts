import { of, throwError } from 'rxjs';
import { CorrelationMiddleware } from './correlation.middleware';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';
import { RequestContextService } from './request-context.service';
import { StructuredLoggerService } from './structured-logger.service';

describe('Enterprise observability', () => {
  it('generates request id and trace id when client does not send them', (done) => {
    const context = new RequestContextService();
    const middleware = new CorrelationMiddleware(context);
    const req = { headers: {}, method: 'GET', originalUrl: '/health/live' };
    const res = { setHeader: jest.fn() };

    middleware.use(req, res, () => {
      expect(context.getRequestId()).toBeDefined();
      expect(context.getTraceId()).toBeDefined();
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('x-trace-id', expect.any(String));
      done();
    });
  });

  it('reuses valid incoming request id', (done) => {
    const context = new RequestContextService();
    const middleware = new CorrelationMiddleware(context);
    const req = { headers: { 'x-request-id': 'client-request-1234' }, method: 'GET', originalUrl: '/api/auth/login' };
    const res = { setHeader: jest.fn() };

    middleware.use(req, res, () => {
      expect(context.getRequestId()).toBe('client-request-1234');
      done();
    });
  });

  it('records HTTP metrics through interceptor', (done) => {
    const metrics = new MetricsService();
    const context = new RequestContextService();
    const interceptor = new MetricsInterceptor(metrics, context);
    const executionContext = mockExecutionContext('/api/auth/login', 200);

    interceptor.intercept(executionContext as any, { handle: () => of({ ok: true }) } as any).subscribe(async () => {
      const output = await metrics.registry.metrics();
      expect(output).toContain('integrity_http_requests_total');
      expect(output).toContain('route="/api/auth/login"');
      done();
    });
  });

  it('records failed HTTP metrics through interceptor', (done) => {
    const metrics = new MetricsService();
    const context = new RequestContextService();
    const interceptor = new MetricsInterceptor(metrics, context);
    const executionContext = mockExecutionContext('/api/evaluations/attempts/123/finalize', 500);

    interceptor.intercept(executionContext as any, { handle: () => throwError(() => ({ status: 500 })) } as any).subscribe({
      error: async () => {
        const output = await metrics.registry.metrics();
        expect(output).toContain('status="500"');
        done();
      },
    });
  });

  it('health liveness is always ok', () => {
    const service = buildHealthService();
    expect(service.liveness().status).toBe('ok');
  });

  it('readiness is ready when critical dependencies are up', async () => {
    const service = buildHealthService();
    jest.spyOn(service as any, 'dependencies').mockResolvedValue({
      dependencies: [
        { name: 'postgresql', status: 'up' },
        { name: 'redis', status: 'up' },
        { name: 'queue', status: 'up' },
      ],
    });

    await expect(service.readiness()).resolves.toMatchObject({ status: 'ready' });
  });

  it('readiness fails when postgres is down', async () => {
    const service = buildHealthService();
    jest.spyOn(service as any, 'dependencies').mockResolvedValue({
      dependencies: [
        { name: 'postgresql', status: 'down' },
        { name: 'redis', status: 'up' },
        { name: 'queue', status: 'up' },
      ],
    });

    await expect(service.readiness()).resolves.toMatchObject({ status: 'not_ready' });
  });

  it('readiness fails when redis or queue are down', async () => {
    const service = buildHealthService();
    jest.spyOn(service as any, 'dependencies').mockResolvedValue({
      dependencies: [
        { name: 'postgresql', status: 'up' },
        { name: 'redis', status: 'down' },
        { name: 'queue', status: 'down' },
      ],
    });

    await expect(service.readiness()).resolves.toMatchObject({ status: 'not_ready' });
  });

  it('detects storage unavailable', async () => {
    const originalEnv = { ...process.env };
    process.env = {
      ...originalEnv,
      STORAGE_PROVIDER: 'local-private',
      STORAGE_LOCAL_PRIVATE_PATH: '/dev/null/not-writable',
    };
    const service = buildHealthService();
    const result = await (service as any).checkStorage();

    expect(result.status).toBe('down');
    process.env = originalEnv;
  });

  it('health controller returns 503 for non-ready status', async () => {
    const health = { readiness: jest.fn().mockResolvedValue({ status: 'not_ready' }) } as any;
    const controller = new HealthController(health);
    const res = mockResponse();

    await controller.ready(res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ status: 'not_ready' });
  });

  it('metrics endpoint exposes Prometheus text', async () => {
    const metrics = new MetricsService();
    metrics.recordDomainEvent('Authentication', 'login', 'success');
    const controller = new MetricsController(metrics);

    await expect(controller.scrape()).resolves.toContain('integrity_domain_events_total');
  });

  it('structured logger redacts sensitive fields', () => {
    const context = new RequestContextService();
    const logger = new StructuredLoggerService(context);
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    logger.log('password=secret refreshToken=abc ok', 'TestModule');

    expect(stdout.mock.calls[0][0]).toContain('password=[REDACTED]');
    expect(stdout.mock.calls[0][0]).toContain('refreshToken=[REDACTED]');
    stdout.mockRestore();
  });

  function buildHealthService() {
    const prisma = { $queryRaw: jest.fn() } as any;
    const metrics = new MetricsService();
    const events = { publish: jest.fn() } as any;
    return new HealthService(prisma, metrics, events);
  }

  function mockExecutionContext(path: string, statusCode: number) {
    const req = {
      method: 'GET',
      originalUrl: path,
      url: path,
      route: { path },
      user: { userId: 'user-1', organizationId: 'org-1' },
    };
    const res = { statusCode };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    };
  }

  function mockResponse() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  }
});
