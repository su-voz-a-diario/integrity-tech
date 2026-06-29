import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { json, urlencoded } from 'express';

async function bootstrap() {
  // Inicializar NestJS utilizando el adaptador de Express explícito
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Configurar límite del parser del Body para admitir imágenes Base64 grandes
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  // Servir archivos estáticos de forma pública (para almacenar las fotos de los candidatos)
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Establecer prefijo global de API
  app.setGlobalPrefix('api');
  
  // Habilitar validaciones estructuradas globales (class-validator)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Habilitar CORS para peticiones cruzadas del frontend
  app.enableCors();

  // Configuración de la documentación interactiva Swagger / OpenAPI (restringido a dev/staging)
  const port = process.env.PORT || 3000;
  if (process.env.NODE_ENV !== 'production' || process.env.SHOW_SWAGGER === 'true') {
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
      
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`[Bootstrap] Documentación interactiva de Swagger montada en: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  console.log(`[Bootstrap] Servidor de API de Integrity-Tech escuchando en: http://localhost:${port}/api`);
}
bootstrap();
