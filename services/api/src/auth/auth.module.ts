import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { TokenController } from './token.controller.js';
import { TokenService } from './token.service.js';

/**
 * Global auth + API token management.
 * APP_GUARD runs for every route; controllers mark public routes with @Public()
 * (see public.decorator.ts). The guard is instantiated via an explicit
 * useFactory with inject: [TokenService] — constructor param-metadata is NOT
 * relied on, because vitest's esbuild transform may not emit design:paramtypes
 * (the P0 gotcha: guards instantiated via `new` or missing metadata lose DI).
 * TokenService is exported so feature modules can issue/resolve/verify tokens.
 */
@Global()
@Module({
  controllers: [TokenController],
  providers: [
    {
      provide: APP_GUARD,
      useFactory: (tokenService: TokenService) => new AuthGuard(tokenService),
      inject: [TokenService],
    },
    TokenService,
  ],
  exports: [TokenService],
})
export class AuthModule {}
