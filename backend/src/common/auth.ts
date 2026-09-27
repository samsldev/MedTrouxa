import {
  CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export interface JwtUser { sub: string; email: string; role: 'student' | 'admin'; name: string }

export const Public = () => SetMetadata('public', true);
export const AdminOnly = () => SetMetadata('admin', true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): JwtUser =>
  ctx.switchToHttp().getRequest().user);

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('public', targets)) return true;
    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();
    try {
      req.user = this.jwt.verify<JwtUser>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (this.reflector.getAllAndOverride<boolean>('admin', targets) && req.user.role !== 'admin') {
      throw new ForbiddenException();
    }
    return true;
  }
}
