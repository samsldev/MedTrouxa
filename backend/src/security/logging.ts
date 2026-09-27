import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/** Mascara e-mails em logs (LGPD: minimização de dados pessoais). */
export const maskEmail = (e?: string) => (e ? e.replace(/^(.).*(@.*)$/, '$1***$2') : '');

const security = new Logger('Security');
/** Eventos de segurança estruturados (OWASP A09). Nunca registra senhas ou tokens. */
export const securityEvent = (event: string, data: Record<string, unknown> = {}) =>
  security.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }));

/** Request id + log de acesso (método, rota, status, duração), sem corpo nem cabeçalhos sensíveis. */
@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  private log = new Logger('HTTP');
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { id?: string; user?: { sub: string } }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const id = (req.headers['x-request-id'] as string)?.slice(0, 64) || randomUUID();
    req.id = id;
    res.setHeader('X-Request-Id', id);
    const t0 = Date.now();
    const done = () => this.log.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t0}ms id=${id}${req.user ? ` user=${req.user.sub}` : ''}`);
    return next.handle().pipe(tap({ next: done, error: () => setImmediate(done) }));
  }
}
