import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MetricsService } from './metrics.service';

@Injectable()
export class PrismaTelemetryService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit() {
    this.prisma.setMetrics(this.metrics);
  }
}
