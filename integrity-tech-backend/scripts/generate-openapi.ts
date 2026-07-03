import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { configureApiPrefix, createOpenApiDocument } from '../src/openapi';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApiPrefix(app);

  const document = createOpenApiDocument(app);
  const outputPath = resolve(process.cwd(), 'openapi.json');
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
  console.log(`[openapi] Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error('[openapi] Failed to generate OpenAPI document');
  console.error(error);
  process.exit(1);
});
