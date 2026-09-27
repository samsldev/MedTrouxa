import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, Injectable, Module, Post, Req, Res,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Equals, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { createHash, randomBytes } from 'crypto';
import type { CookieOptions, Request, Response } from 'express';
import { Repository } from 'typeorm';
import { CurrentUser, JwtUser, Public } from '../common/auth';
import { appUrl, isProd } from '../config/env';
import { User } from '../database/entities';
import { RedisService } from '../redis/redis.module';
import { maskEmail, securityEvent } from '../security/logging';
import { MailService } from '../security/mail';
import { hashPassword, passwordProblem, verifyPassword } from '../security/password';
import { OtpService } from '../security/otp';
import { RateLimit } from '../security/rate-limit';
import { MfaMethod, TwoFactorService } from '../security/twofactor';

export const TERMS_VERSION = '2026-09';
const ACCESS_TTL = '15m';
const REFRESH_TTL_SEC = 30 * 24 * 3600;
const RT_COOKIE = 'mt_rt';
/** Apps nativos: sessão deslizante mais longa (o refresh token fica no Keychain/Keystore, não em cookie). */
const MOBILE_REFRESH_TTL_SEC = 90 * 24 * 3600;

/**
 * Cliente nativo (app Android/iOS): pede o refresh token no corpo em vez de cookie.
 * Navegadores sempre mandam Origin em POST cross-site; em produção só aceitamos o modo app sem Origin
 * (apps nativos não enviam), então uma página web não consegue usar esse modo para escapar do cookie httpOnly.
 */
export function isMobileClient(req: Request | undefined): boolean {
  if (!req || req.headers['x-client'] !== 'mobile') return false;
  return !req.headers.origin || !isProd();
}
const LOCK_MAX_FAILS = 5;
const LOCK_WINDOW_SEC = 15 * 60;

class RegisterDto {
  @IsString() @Length(2, 120) name: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MaxLength(128) password: string;
  @IsOptional() @IsString() @MaxLength(160) university?: string;
  @IsOptional() @IsInt() @Min(1) @Max(12) semester?: number;
  @IsBoolean() @Equals(true, { message: 'É preciso aceitar os Termos de uso e a Política de privacidade' }) acceptTerms: boolean;
}
class LoginDto { @IsEmail() @MaxLength(254) email: string; @IsString() @MaxLength(128) password: string }
class ForgotDto { @IsEmail() @MaxLength(254) email: string }
class ChallengeDto { @IsString() @Length(20, 100) challenge: string }
class VerifyCodeDto extends ChallengeDto { @IsString() @Length(6, 12) code: string }
class MfaDto extends VerifyCodeDto { @IsIn(['totp', 'email', 'recovery']) method: MfaMethod }
class ResetDto { @IsString() @Length(20, 200) token: string; @IsString() @MaxLength(128) password: string }

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private jwt: JwtService,
    private redis: RedisService,
    private mail: MailService,
    private otp: OtpService,
    private twoFactor: TwoFactorService,
  ) {}

  cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: isProd(), sameSite: 'strict', path: '/api/auth', maxAge: REFRESH_TTL_SEC * 1000 };
  }

  /** Emite access token (curto) + refresh token opaco (guardado como hash no Redis, rotacionado a cada uso). */
  async issue(user: User, res: Response) {
    const full = await this.users.findOne({ where: { id: user.id }, select: ['id', 'tokenVersion', 'twoFactorMethod', 'suspendedAt'] });
    if (full?.suspendedAt) throw new ForbiddenException('Conta suspensa. Fale com o suporte.');
    const tv = full?.tokenVersion ?? 0;
    const payload: JwtUser = { sub: user.id, email: user.email, role: user.role, name: user.name, tv, mfa: full?.twoFactorMethod ?? null };
    const rt = randomBytes(32).toString('base64url');
    const mobile = isMobileClient(res.req as Request);
    await this.redis.client.set(`rt:${sha256(rt)}`, JSON.stringify({ uid: user.id, tv, m: mobile ? 1 : 0 }), 'EX', mobile ? MOBILE_REFRESH_TTL_SEC : REFRESH_TTL_SEC);
    if (!mobile) res.cookie(RT_COOKIE, rt, this.cookieOptions());
    const { passwordHash: _p, tokenVersion: _t, ...safe } = user as User & { tokenVersion?: number };
    return {
      status: 'ok' as const, accessToken: this.jwt.sign(payload, { expiresIn: ACCESS_TTL, algorithm: 'HS256' }), user: safe,
      ...(mobile ? { refreshToken: rt } : {}),
    };
  }

  /** Revoga todas as sessões do usuário (troca de senha, reuso de token, exclusão de conta). */
  async revokeAll(userId: string) {
    await this.users.increment({ id: userId }, 'tokenVersion', 1);
    const u = await this.users.findOne({ where: { id: userId }, select: ['id', 'tokenVersion'] });
    // Guardado por mais tempo que a vida do access token, para o guard rejeitar tokens antigos
    await this.redis.client.set(`tv:${userId}`, String(u?.tokenVersion ?? 0), 'EX', 24 * 3600).catch(() => undefined);
  }

  async register(dto: RegisterDto, res: Response) {
    const email = dto.email.trim().toLowerCase();
    const problem = passwordProblem(dto.password, email);
    if (problem) throw new BadRequestException(problem);
    if (await this.users.exists({ where: { email } })) throw new ConflictException('Não foi possível criar a conta com esse e-mail');
    const user = await this.users.save(this.users.create({
      name: dto.name.trim(), email, university: dto.university?.trim(), semester: dto.semester,
      passwordHash: await hashPassword(dto.password), termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION,
    }));
    securityEvent('auth.register', { user: user.id });
    return this.startEmailVerification(user);
  }

  /** Cria o desafio de confirmação de e-mail e envia o código de 6 dígitos. */
  private async startEmailVerification(user: User) {
    const challenge = await this.otp.create(user.id, 'verify_email');
    await this.otp.sendCode(challenge, user, { cooldown: false });
    return { status: 'verify_email' as const, challenge, email: maskEmail(user.email) };
  }

  /** Após a senha: exige confirmação de e-mail e/ou segundo fator antes de emitir a sessão. */
  private async afterPassword(user: User, res: Response) {
    if (!user.emailVerifiedAt) return this.startEmailVerification(user);
    if (user.twoFactorMethod) {
      const challenge = await this.otp.create(user.id, 'mfa');
      if (user.twoFactorMethod === 'email') await this.otp.sendCode(challenge, user, { cooldown: false });
      return { status: 'mfa' as const, challenge, method: user.twoFactorMethod, email: maskEmail(user.email) };
    }
    return this.issue(user, res);
  }

  async verifyEmail(dto: VerifyCodeDto, res: Response) {
    const ch = await this.otp.get(dto.challenge, 'verify_email');
    if (!(await this.otp.checkEmailCode(dto.challenge, dto.code))) await this.otp.fail(dto.challenge);
    await this.otp.consume(dto.challenge);
    await this.users.update(ch.uid, { emailVerifiedAt: new Date() });
    const user = await this.users.findOneByOrFail({ id: ch.uid });
    securityEvent('auth.email_verified', { user: user.id });
    return this.afterPassword(user, res); // se tiver 2FA, ainda pede o segundo fator
  }

  async mfa(dto: MfaDto, ip: string, res: Response) {
    const ch = await this.otp.get(dto.challenge, 'mfa');
    const ok = await this.twoFactor.verify(ch.uid, dto.method, dto.code, dto.challenge);
    if (!ok) {
      securityEvent('auth.mfa_failed', { user: ch.uid, method: dto.method, ip });
      await this.otp.fail(dto.challenge);
    }
    await this.otp.consume(dto.challenge);
    const user = await this.users.findOneByOrFail({ id: ch.uid });
    securityEvent('auth.login', { user: user.id, ip, mfa: dto.method });
    if (dto.method === 'recovery') {
      const left = await this.twoFactor.recoveryLeft(user.id);
      await this.mail.send(user.email, 'Código de recuperação usado — MedTrouxa',
        `Olá, ${user.name}.

Um código de recuperação foi usado para entrar na sua conta. Restam ${left}.
Se não foi você, troque sua senha imediatamente.`).catch(() => undefined);
    }
    return this.issue(user, res);
  }

  async resend(dto: ChallengeDto) {
    const ch = await this.otp.get(dto.challenge, ['verify_email', 'mfa']);
    const user = await this.users.findOneByOrFail({ id: ch.uid });
    if (ch.purpose === 'mfa' && user.twoFactorMethod !== 'email') throw new BadRequestException('Use seu app autenticador ou um código de recuperação');
    await this.otp.sendCode(dto.challenge, user);
    return { sent: true };
  }

  async login(dto: LoginDto, ip: string, res: Response) {
    const email = dto.email.trim().toLowerCase();
    const lockKey = `lf:${sha256(email)}`;
    const fails = Number(await this.redis.client.get(lockKey).catch(() => 0)) || 0;
    if (fails >= LOCK_MAX_FAILS) {
      securityEvent('auth.locked', { email: maskEmail(email), ip });
      throw new UnauthorizedException('Muitas tentativas. Aguarde 15 minutos ou redefina sua senha.');
    }
    const user = await this.users.findOne({
      where: { email },
      select: ['id', 'name', 'email', 'role', 'university', 'semester', 'xp', 'createdAt', 'passwordHash', 'emailVerifiedAt', 'twoFactorMethod'],
    });
    const ok = await verifyPassword(dto.password, user?.passwordHash);
    if (!user || !ok) {
      await this.redis.client.multi().incr(lockKey).expire(lockKey, LOCK_WINDOW_SEC).exec().catch(() => undefined);
      securityEvent('auth.login_failed', { email: maskEmail(email), ip });
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    await this.redis.client.del(lockKey).catch(() => undefined);
    if (!user.twoFactorMethod && user.emailVerifiedAt) securityEvent('auth.login', { user: user.id, ip });
    return this.afterPassword(user, res);
  }

  /** Refresh token do pedido: corpo (app nativo) ou cookie httpOnly (web). */
  private tokenFrom(req: Request): unknown {
    return isMobileClient(req) ? (req.body as { refreshToken?: unknown } | undefined)?.refreshToken : req.cookies?.[RT_COOKIE];
  }

  async refresh(req: Request, res: Response) {
    const rt = this.tokenFrom(req);
    if (!rt || typeof rt !== 'string') throw new UnauthorizedException();
    const h = sha256(rt);
    const raw = await this.redis.client.getdel(`rt:${h}`);
    if (!raw) {
      // Token desconhecido: se já foi usado antes, é reuso (possível roubo) → revoga tudo
      const reusedBy = await this.redis.client.get(`rtu:${h}`);
      if (reusedBy) { await this.revokeAll(reusedBy); securityEvent('auth.refresh_reuse', { user: reusedBy }); }
      res.clearCookie(RT_COOKIE, { ...this.cookieOptions(), maxAge: undefined });
      throw new UnauthorizedException();
    }
    const { uid, tv } = JSON.parse(raw) as { uid: string; tv: number };
    await this.redis.client.set(`rtu:${h}`, uid, 'EX', REFRESH_TTL_SEC);
    const user = await this.users.findOne({ where: { id: uid }, select: ['id', 'name', 'email', 'role', 'university', 'semester', 'xp', 'createdAt', 'tokenVersion'] });
    if (!user || user.tokenVersion !== tv) throw new UnauthorizedException();
    return this.issue(user, res);
  }

  async logout(req: Request, res: Response) {
    const rt = this.tokenFrom(req);
    if (typeof rt === 'string') await this.redis.client.del(`rt:${sha256(rt)}`).catch(() => undefined);
    res.clearCookie(RT_COOKIE, { ...this.cookieOptions(), maxAge: undefined });
  }

  async forgot(email: string) {
    const user = await this.users.findOneBy({ email: email.trim().toLowerCase() });
    if (!user) return; // resposta idêntica: não revela se o e-mail existe
    const token = randomBytes(32).toString('base64url');
    await this.redis.client.set(`pr:${sha256(token)}`, user.id, 'EX', 30 * 60);
    const link = `${appUrl()}/redefinir-senha?token=${token}`;
    await this.mail.send(user.email, 'Redefinição de senha — MedTrouxa',
      `Olá, ${user.name}.\n\nPara criar uma nova senha, acesse (válido por 30 minutos):\n${link}\n\nSe você não pediu, ignore este e-mail.`);
    securityEvent('auth.password_reset_requested', { user: user.id });
  }

  async reset(dto: ResetDto) {
    const uid = await this.redis.client.getdel(`pr:${sha256(dto.token)}`);
    if (!uid) throw new BadRequestException('Link inválido ou expirado');
    const user = await this.users.findOneByOrFail({ id: uid });
    const problem = passwordProblem(dto.password, user.email);
    if (problem) throw new BadRequestException(problem);
    await this.users.update(uid, { passwordHash: await hashPassword(dto.password), emailVerifiedAt: user.emailVerifiedAt ?? new Date() });
    await this.revokeAll(uid);
    securityEvent('auth.password_reset', { user: uid });
  }
}

/** Anti-CSRF para rotas que usam cookie: exige Origin/Referer do próprio site (além do SameSite=Strict). */
function assertSameOrigin(req: Request) {
  if (isMobileClient(req)) return; // app nativo: token no corpo, sem cookie → não há CSRF
  const origin = req.headers.origin ?? (req.headers.referer ? new URL(req.headers.referer).origin : undefined);
  if (!origin) { if (isProd()) throw new ForbiddenException(); return; }
  const allowed = [appUrl(), ...(isProd() ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173'])];
  if (!allowed.includes(origin)) throw new ForbiddenException();
}

@Controller('auth')
class AuthController {
  constructor(private auth: AuthService, @InjectRepository(User) private users: Repository<User>) {}

  @Public() @Post('register') @RateLimit({ limit: 5, windowSec: 600 })
  register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) { return this.auth.register(dto, res); }

  @Public() @Post('login') @HttpCode(200) @RateLimit({ limit: 10, windowSec: 300 })
  login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.login(dto, req.ip ?? '', res); }

  @Public() @Post('verify-email') @HttpCode(200) @RateLimit({ limit: 15, windowSec: 600 })
  verifyEmail(@Body() dto: VerifyCodeDto, @Res({ passthrough: true }) res: Response) { return this.auth.verifyEmail(dto, res); }

  @Public() @Post('mfa') @HttpCode(200) @RateLimit({ limit: 15, windowSec: 600 })
  mfa(@Body() dto: MfaDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.mfa(dto, req.ip ?? '', res); }

  @Public() @Post('resend-code') @HttpCode(200) @RateLimit({ limit: 6, windowSec: 600 })
  resend(@Body() dto: ChallengeDto) { return this.auth.resend(dto); }

  @Public() @Post('refresh') @HttpCode(200) @RateLimit({ limit: 30, windowSec: 60 })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) { assertSameOrigin(req); return this.auth.refresh(req, res); }

  @Public() @Post('logout') @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { assertSameOrigin(req); await this.auth.logout(req, res); }

  @Post('logout-all') @HttpCode(204)
  async logoutAll(@CurrentUser() u: JwtUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.revokeAll(u.sub); await this.auth.logout(req, res);
  }

  @Public() @Post('forgot') @HttpCode(202) @RateLimit({ limit: 5, windowSec: 900 })
  async forgot(@Body() dto: ForgotDto) {
    await this.auth.forgot(dto.email);
    return { message: 'Se houver uma conta com esse e-mail, enviaremos um link de redefinição.' };
  }

  @Public() @Post('reset') @HttpCode(204) @RateLimit({ limit: 10, windowSec: 900 })
  reset(@Body() dto: ResetDto) { return this.auth.reset(dto); }

  @Get('me') me(@CurrentUser() u: JwtUser) { return this.users.findOneByOrFail({ id: u.sub }); }
}

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AuthController],
  providers: [AuthService, MailService, OtpService, TwoFactorService],
  exports: [AuthService, OtpService, TwoFactorService, MailService],
})
export class AuthModule {}
