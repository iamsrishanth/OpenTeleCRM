import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: process.env.LOG_LEVEL === 'debug' }),
  );

  // The public sync API base path is /autoupdate/v2 (TeleCRM parity).
  app.setGlobalPrefix(process.env.API_BASE_PATH ?? '/autoupdate/v2', {
    exclude: ['/health'],
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`OpenTeleCRM API listening on http://0.0.0.0:${port} (prefix ${process.env.API_BASE_PATH ?? '/autoupdate/v2'})`);
}

bootstrap().catch((err) => {
  console.error('API bootstrap failed:', err);
  process.exit(1);
});
