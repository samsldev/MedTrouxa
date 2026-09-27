import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RedisService } from '../redis/redis.module';

export interface RateLimitRule { limit: number; windowSec: number; key?: 'ip' | 'user' }

/** Limite de requisições por rota (sobrescreve o global). OWASP A04/A07: brute force, abuso, DoS de aplicação. */
export const RateLimit = (rule: RateLimitRule) => SetMetadata('rateLimit', rule);

const GLOBAL: RateLimitRule = { limit: 300, windowSec: 60 };

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private redis: RedisService, private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.getAllAndOverride<RateLimitRule>('rateLimit', [ctx.getHandler(), ctx.getClass()]) ?? GLOBAL;
    const req = ctx.switchToHttp().getRequest<Request & { user?: { sub: string } }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const who = rule.key === 'user' && req.user ? `u:${req.user.sub}` : `ip:${req.ip}`;
    const route = `${req.method}:${req.route?.path ?? req.path}`;
    const bucket = Math.floor(Date.now() / 1000 / rule.windowSec);
    const key = `rl:${route}:${who}:${bucket}`;
    let n = 0;
    try {
      n = await this.redis.client.incr(key);
      if (n === 1) await this.redis.client.expire(key, rule.windowSec);
    } catch {
      return true; // Redis fora: não derruba a API (fail-open só para o rate limit)
    }
    res.setHeader('RateLimit-Limit', rule.limit);
    res.setHeader('RateLimit-Remaining', Math.max(0, rule.limit - n));
    if (n > rule.limit) {
      res.setHeader('Retry-After', rule.windowSec);
      throw new HttpException('Muitas requisições. Tente novamente em instantes.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
