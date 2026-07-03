import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '../database/database.module';
import { CorrelationMiddleware } from './correlation.middleware';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';
import { OperationalEventPublisher } from './operational-event.publisher';
import { PrismaTelemetryService } from './prisma-telemetry.service';
import { RequestContextService } from './request-context.service';
import { StructuredLoggerService } from './structured-logger.service';

@Global()
@Module({
  imports: [DatabaseModule, EventEmitterModule],
  controllers: [HealthController, MetricsController],
  providers: [
    RequestContextService,
    StructuredLoggerService,
    MetricsService,
    HealthService,
    OperationalEventPublisher,
    PrismaTelemetryService,
    CorrelationMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [
    RequestContextService,
    StructuredLoggerService,
    MetricsService,
    HealthService,
    OperationalEventPublisher,
  ],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
