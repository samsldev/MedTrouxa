import {
  CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.module';

export interface JwtUser { sub: string; email: string; role: 'student' | 'admin'; name: string; tv: number }

export const Public = () => SetMetadata('public', true);
export const AdminOnly = () => SetMetadata('admin', true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): JwtUser =>
  ctx.switchToHttp().getRequest().user);

/** Autenticação por Bearer JWT (curta duração) + checagem de revogação por tokenVersion (cache no Redis). */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector, private redis: RedisService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('public', targets)) return true;
    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();
    let user: JwtUser;
    try {
      user = this.jwt.verify<JwtUser>(token, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException();
    }
    const current = await this.redis.client.get(`tv:${user.sub}`).catch(() => null);
    if (current !== null && Number(current) !== user.tv) throw new UnauthorizedException('Sessão encerrada');
    req.user = user;
    if (this.reflector.getAllAndOverride<boolean>('admin', targets) && user.role !== 'admin') throw new ForbiddenException();
    return true;
  }
}
