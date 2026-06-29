import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');
  
  logger.log('Iniciando contexto de aplicación headless para Worker-Service...');

  // Creamos un contexto de aplicación (Application Context) en lugar de una aplicación web completa.
  // Esto inicializa el contenedor IoC de NestJS y arranca las colas de BullMQ,
  // pero NO abre ningún puerto de red ni levanta Express/Fastify.
  const app = await NestFactory.createApplicationContext(AppModule);
  
  logger.log('Servidor de colas inicializado y escuchando tareas en Redis.');

  // Habilitar cierre limpio de conexiones ante señales de terminación (SIGTERM / SIGINT)
  app.enableShutdownHooks();
}

bootstrap();
