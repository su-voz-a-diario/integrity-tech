import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });

    // Suscribir a logs de queries en entorno de desarrollo para depuración de rendimiento
    if (process.env.NODE_ENV !== 'production') {
      (this as any).$on('query', (e: any) => {
        this.logger.debug(`Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
      });
    }
  }

  async onModuleInit() {
    this.logger.log('Iniciando conexión a base de datos PostgreSQL mediante Prisma...');
    await this.$connect();
    this.logger.log('Conexión a PostgreSQL establecida con éxito.');
  }

  async onModuleDestroy() {
    this.logger.log('Cerrando conexión a PostgreSQL...');
    await this.$disconnect();
    this.logger.log('Conexión a PostgreSQL cerrada.');
  }
}
