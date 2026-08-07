import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

/** Fail fast on insecure boot configurations. */
function assertSafeBoot() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') {
    // The dev JWT backdoor must never run in production (ADR-0025). A
    // misconfigured deploy that sets DEV_JWT_SECRET would accept forged HS256
    // JWTs for any enterpriseId — refuse to boot instead.
    if (process.env.DEV_JWT_SECRET) {
      throw new Error(
        'Refusing to boot in production with DEV_JWT_SECRET set — remove the dev backdoor (see docs/DECISIONS.md ADR-0025).',
      );
    }
    // OIDC signature verification is not implemented; failing closed means
    // ZITADEL_ISSUER must not be set until a real JWKS-verified path lands.
    if (process.env.ZITADEL_ISSUER) {
      throw new Error(
        'Refusing to boot in production with ZITADEL_ISSUER set — OIDC verification (JWKS) is not implemented; unset it or wire up jose/JWKS first (docs/RISKS.md).',
      );
    }
  }
}

async function bootstrap() {
  assertSafeBoot();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: process.env.LOG_LEVEL === 'debug' }),
  );

  // The public sync API base path is /autoupdate/v2 (TeleCRM parity).
  app.setGlobalPrefix(process.env.API_BASE_PATH ?? '/autoupdate/v2', {
    exclude: ['/health'],
  });

  // First-class web client (apps/web) on a different origin in dev.
  // Explicit allowlist, NOT origin:true — origin:true reflects any origin
  // with credentials, which is only safe while auth is Bearer-header based.
  // CORS_ORIGINS is a comma-separated list; default covers the local web desk
  // and the tunnel hostname used by `make tunnel`.
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3007,http://127.0.0.1:3007')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`OpenTeleCRM API listening on http://0.0.0.0:${port} (prefix ${process.env.API_BASE_PATH ?? '/autoupdate/v2'})`);
}

bootstrap().catch((err) => {
  console.error('API bootstrap failed:', err);
  process.exit(1);
});
