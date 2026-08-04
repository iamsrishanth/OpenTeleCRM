import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';

/**
 * Global auth. APP_GUARD runs for every route; controllers mark public routes
 * with @Public() (see public.decorator.ts). The guard is instantiated by the
 * DI container so Reflector is injected — do NOT also register it as a plain
 * provider or use it via @UseGuards() (that path uses `new` and loses DI).
 */
@Global()
@Module({
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}