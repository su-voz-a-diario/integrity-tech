import { INestApplication, RequestMethod } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureApiPrefix(app: INestApplication) {
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
      { path: 'health/dependencies', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });
}

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Integrity-Tech | Platform API')
    .setDescription('Especificación técnica de la API REST para el motor transaccional de evaluaciones psicométricas, telemetría de proctoring y feedback de PMF.')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Ingresa tu Token JWT de sesión para autenticar las peticiones',
      in: 'header',
    })
    .build();

  return SwaggerModule.createDocument(app, config);
}
