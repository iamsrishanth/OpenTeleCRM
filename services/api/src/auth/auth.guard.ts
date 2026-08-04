import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import type { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from './public.decorator.js';

export interface AuthContext {
  /** Enterprise id the token is scoped to. */
  enterpriseId: string;
  /** Platform user id (from sub claim) if present. */
  userId?: string;
  /** The raw token type, if an API token was used. */
  tokenType: 'token' | 'dev-jwt' | 'oidc';
  /** API token row id when authed via API token. */
  apiTokenId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

/**
 * Auth guard: accepts an API `Bearer <token>` (async/sync TeleCRM-style),
 * a dev JWT (local dev), or a Zitadel OIDC id-token (when configured).
 * Token type classes are enforced where it matters (see token service).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  // Reflector is a thin wrapper over Reflect metadata — safe to instantiate
  // directly; avoids DI resolution quirks under tsx/Fastify.
  private reflector = new Reflector();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException({ error: { code: 'NOT_AUTHORIZED', message: 'Missing Authorization header' } });
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException({ error: { code: 'NOT_AUTHORIZED', message: 'Invalid Authorization scheme' } });
    }

    const ctx = await this.resolve(token);
    req.auth = ctx;
    return true;
  }

  private async resolve(token: string): Promise<AuthContext> {
    // 1) API token (TeleCRM-style): format `telekrm_async_<uuid>` / `telekrm_sync_<uuid>`.
    if (token.startsWith('tele')) {
      return { enterpriseId: token, tokenType: 'token' };
    }
    // 2) Dev JWT (HS256) in local/dev mode.
    const devSecret = process.env.DEV_JWT_SECRET;
    if (devSecret) {
      try {
        const payload = jwt.verify(token, devSecret) as { enterpriseId: string; sub?: string };
        return { enterpriseId: payload.enterpriseId, userId: payload.sub, tokenType: 'dev-jwt' };
      } catch {
        // not a dev JWT — fall through
      }
    }
    // 3) Zitadel OIDC id-token (RS256, issuer-checked).
    if (process.env.ZITADEL_ISSUER) {
      try {
        const payload = jwt.decode(token) as { enterpriseId?: string; sub?: string };
        if (payload?.enterpriseId) {
          return { enterpriseId: payload.enterpriseId, userId: payload.sub, tokenType: 'oidc' };
        }
      } catch {
        /* fall through */
      }
    }
    throw new UnauthorizedException({ error: { code: 'NOT_AUTHORIZED', message: 'Invalid or expired token' } });
  }
}