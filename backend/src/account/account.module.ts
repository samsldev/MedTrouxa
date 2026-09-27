import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Module, Patch, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource, InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import * as QRCode from 'qrcode';
import type { Request, Response } from 'express';
import { DataSource, Repository } from 'typeorm';
import { AuthModule, AuthService } from '../auth/auth.module';
import { CurrentUser, JwtUser } from '../common/auth';
import { User } from '../database/entities';
import { RedisService } from '../redis/redis.module';
import { securityEvent } from '../security/logging';
import { hashPassword, passwordProblem, verifyPassword } from '../security/password';
import { decrypt, encrypt, sha256 } from '../security/crypto';
import { MailService } from '../security/mail';
import { generateRecoveryCodes, OtpService } from '../security/otp';
import { RateLimit } from '../security/rate-limit';
import { generateTotpSecret, otpauthUrl, verifyTotp } from '../security/totp';
import { MfaMethod, TwoFactorService } from '../security/twofactor';
import { IsClean } from '../security/profanity';

class ProfileDto {
  @IsOptional() @IsString() @Length(2, 120) @IsClean() name?: string;
  @IsOptional() @IsString() @MaxLength(160) @IsClean() university?: string;
  @IsOptional() @IsInt() @Min(1) @Max(12) semester?: number;
}
class PasswordDto { @IsString() @MaxLength(128) currentPassword: string; @IsString() @MaxLength(128) newPassword: string }
class CodeDto { @IsString() @Length(6, 12) code: string }
class EmailEnableDto extends CodeDto { @IsString() @Length(20, 100) challenge: string }
class ConfirmDto {
  @IsString() @MaxLength(128) password: string;
  @IsIn(['totp', 'email', 'recovery']) method: MfaMethod;
  @IsString() @Length(6, 12) code: string;
  @IsOptional() @IsString() @Length(20, 100) challenge?: string;
}
class DeleteDto { @IsString() @MaxLength(128) password: string }

/** Direitos do titular (LGPD art. 18): acesso, correção, portabilidade e eliminação. */
@Controller('account')
class AccountController {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectDataSource() private db: DataSource,
    private auth: AuthService,
    private redis: RedisService,
    private otp: OtpService,
    private twoFactor: TwoFactorService,
    private mail: MailService,
  ) {}

  // ---------------- Verificação em duas etapas ----------------

  private notify(u: JwtUser, subject: string, body: string) {
    return this.mail.send(u.email, `${subject} — MedTrouxa`, `Olá, ${u.name}.\n\n${body}\n\nSe não foi você, troque sua senha imediatamente e fale com o suporte.`).catch(() => undefined);
  }

  private async newRecoveryCodes(uid: string) {
    const codes = generateRecoveryCodes();
    await this.users.update(uid, { recoveryCodes: codes.map((c) => sha256(c)) });
    return codes;
  }

  private async confirmSecondFactor(u: JwtUser, dto: ConfirmDto) {
    await this.checkPassword(u.sub, dto.password);
    if (dto.method === 'email') {
      if (!dto.challenge) throw new BadRequestException('Peça o código por e-mail primeiro');
      await this.otp.get(dto.challenge, 'confirm_2fa');
    }
    const ok = await this.twoFactor.verify(u.sub, dto.method, dto.code, dto.challenge);
    if (!ok) {
      if (dto.challenge) await this.otp.fail(dto.challenge);
      throw new BadRequestException('Código inválido');
    }
    if (dto.challenge) await this.otp.consume(dto.challenge);
  }

  @Get('security')
  async security(@CurrentUser() u: JwtUser) {
    const user = await this.users.findOneByOrFail({ id: u.sub });
    return {
      emailVerified: !!user.emailVerifiedAt,
      twoFactorMethod: user.twoFactorMethod ?? null,
      twoFactorEnabledAt: user.twoFactorEnabledAt ?? null,
      recoveryCodesLeft: await this.twoFactor.recoveryLeft(u.sub),
    };
  }

  /** Gera um segredo TOTP pendente (10 min) e devolve o QR Code para o app autenticador. */
  @Post('2fa/totp/setup') @RateLimit({ limit: 10, windowSec: 600, key: 'user' })
  async totpSetup(@CurrentUser() u: JwtUser) {
    const user = await this.users.findOneByOrFail({ id: u.sub });
    if (user.twoFactorMethod) throw new BadRequestException('Desative a verificação atual antes de trocar de método');
    const secret = generateTotpSecret();
    await this.redis.client.set(`totp-setup:${u.sub}`, encrypt(secret), 'EX', 600);
    const url = otpauthUrl(secret, user.email);
    const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 240, color: { dark: '#0e1030', light: '#ffffff' } });
    return { qr, secret: secret.match(/.{1,4}/g)!.join(' '), otpauth: url };
  }

  @Post('2fa/totp/enable') @RateLimit({ limit: 10, windowSec: 600, key: 'user' })
  async totpEnable(@CurrentUser() u: JwtUser, @Body() dto: CodeDto) {
    const enc = await this.redis.client.get(`totp-setup:${u.sub}`);
    if (!enc) throw new BadRequestException('A configuração expirou. Gere um novo QR Code.');
    const secret = decrypt(enc);
    if (verifyTotp(secret, dto.code.replace(/\s/g, '')) === null) throw new BadRequestException('Código inválido. Confira o horário do seu celular.');
    await this.users.update(u.sub, { twoFactorMethod: 'totp', totpSecretEnc: enc, twoFactorEnabledAt: new Date() });
    await this.redis.client.del(`totp-setup:${u.sub}`);
    const recoveryCodes = await this.newRecoveryCodes(u.sub);
    securityEvent('account.2fa_enabled', { user: u.sub, method: 'totp' });
    await this.notify(u, 'Verificação em duas etapas ativada', 'A verificação em duas etapas por aplicativo autenticador foi ativada na sua conta.');
    return { recoveryCodes };
  }

  @Post('2fa/email/setup') @RateLimit({ limit: 5, windowSec: 600, key: 'user' })
  async emailSetup(@CurrentUser() u: JwtUser) {
    const user = await this.users.findOneByOrFail({ id: u.sub });
    if (user.twoFactorMethod) throw new BadRequestException('Desative a verificação atual antes de trocar de método');
    const challenge = await this.otp.create(u.sub, 'setup_email_2fa');
    await this.otp.sendCode(challenge, user, { cooldown: false });
    return { challenge };
  }

  @Post('2fa/email/enable') @RateLimit({ limit: 10, windowSec: 600, key: 'user' })
  async emailEnable(@CurrentUser() u: JwtUser, @Body() dto: EmailEnableDto) {
    const ch = await this.otp.get(dto.challenge, 'setup_email_2fa');
    if (ch.uid !== u.sub) throw new BadRequestException();
    if (!(await this.otp.checkEmailCode(dto.challenge, dto.code))) await this.otp.fail(dto.challenge);
    await this.otp.consume(dto.challenge);
    await this.users.update(u.sub, { twoFactorMethod: 'email', totpSecretEnc: null, twoFactorEnabledAt: new Date() });
    const recoveryCodes = await this.newRecoveryCodes(u.sub);
    securityEvent('account.2fa_enabled', { user: u.sub, method: 'email' });
    await this.notify(u, 'Verificação em duas etapas ativada', 'A verificação em duas etapas por e-mail foi ativada na sua conta.');
    return { recoveryCodes };
  }

  /** Para 2FA por e-mail: envia um código para confirmar alterações sensíveis (desativar, novos códigos). */
  @Post('2fa/confirm-code') @RateLimit({ limit: 5, windowSec: 600, key: 'user' })
  async confirmCode(@CurrentUser() u: JwtUser) {
    const user = await this.users.findOneByOrFail({ id: u.sub });
    if (user.twoFactorMethod !== 'email') throw new BadRequestException('Use seu app autenticador ou um código de recuperação');
    const challenge = await this.otp.create(u.sub, 'confirm_2fa');
    await this.otp.sendCode(challenge, user, { cooldown: false });
    return { challenge };
  }

  @Post('2fa/disable') @HttpCode(204) @RateLimit({ limit: 5, windowSec: 900, key: 'user' })
  async disable(@CurrentUser() u: JwtUser, @Body() dto: ConfirmDto) {
    await this.confirmSecondFactor(u, dto);
    await this.users.update(u.sub, { twoFactorMethod: null, totpSecretEnc: null, recoveryCodes: null, twoFactorEnabledAt: null });
    securityEvent('account.2fa_disabled', { user: u.sub });
    await this.notify(u, 'Verificação em duas etapas desativada', 'A verificação em duas etapas foi desativada na sua conta.');
  }

  @Post('2fa/recovery-codes') @RateLimit({ limit: 5, windowSec: 900, key: 'user' })
  async regenerate(@CurrentUser() u: JwtUser, @Body() dto: ConfirmDto) {
    await this.confirmSecondFactor(u, dto);
    const recoveryCodes = await this.newRecoveryCodes(u.sub);
    securityEvent('account.recovery_codes_regenerated', { user: u.sub });
    await this.notify(u, 'Novos códigos de recuperação', 'Novos códigos de recuperação foram gerados. Os anteriores deixaram de funcionar.');
    return { recoveryCodes };
  }

  private async checkPassword(userId: string, password: string) {
    const u = await this.users.findOne({ where: { id: userId }, select: ['id', 'passwordHash'] });
    if (!u || !(await verifyPassword(password, u.passwordHash))) throw new UnauthorizedException('Senha incorreta');
  }

  @Patch('profile')
  async profile(@CurrentUser() u: JwtUser, @Body() dto: ProfileDto) {
    await this.users.update(u.sub, dto);
    return this.users.findOneByOrFail({ id: u.sub });
  }

  @Post('password') @HttpCode(204) @RateLimit({ limit: 5, windowSec: 900, key: 'user' })
  async password(@CurrentUser() u: JwtUser, @Body() dto: PasswordDto) {
    await this.checkPassword(u.sub, dto.currentPassword);
    const problem = passwordProblem(dto.newPassword, u.email);
    if (problem) throw new BadRequestException(problem);
    await this.users.update(u.sub, { passwordHash: await hashPassword(dto.newPassword) });
    await this.auth.revokeAll(u.sub); // encerra as outras sessões
    securityEvent('account.password_changed', { user: u.sub });
  }

  /** Portabilidade: todos os dados pessoais e de uso do titular em JSON */
  @Get('export') @RateLimit({ limit: 5, windowSec: 3600, key: 'user' })
  @Header('Content-Disposition', 'attachment; filename="medtrouxa-meus-dados.json"')
  async export(@CurrentUser() u: JwtUser) {
    const q = (sql: string) => this.db.query(sql, [u.sub]);
    const [profile] = await q(`SELECT id, name, email, university, semester, xp, "createdAt", "termsAcceptedAt", "termsVersion" FROM users WHERE id = $1`);
    securityEvent('account.exported', { user: u.sub });
    return {
      exportedAt: new Date().toISOString(),
      profile,
      answers: await q(`SELECT "questionId", "chosenKey", correct, "examId", "createdAt" FROM answers WHERE "userId" = $1 ORDER BY id`),
      flashcardReviews: await q(`SELECT "cardId", ease, interval, repetitions, "dueAt" FROM card_reviews WHERE "userId" = $1`),
      decks: await q(`SELECT d.id, d.name, d.description, (SELECT json_agg(json_build_object('front', c.front, 'back', c.back)) FROM flashcards c WHERE c."deckId" = d.id) AS cards FROM decks d WHERE d."ownerId" = $1`),
      exams: await q(`SELECT id, title, "questionIds", "durationMinutes", "startedAt", "finishedAt", score, answers FROM exams WHERE "userId" = $1`),
      studyPlans: await q(`SELECT "planId", completed, "startedAt" FROM plan_enrollments WHERE "userId" = $1`),
      subscriptions: await q(`SELECT "planId", "paymentMethod", installments, amount, status, "paidAt", "startsAt", "expiresAt" FROM subscriptions WHERE "userId" = $1`),
      fiscalIdentity: await q(`SELECT doc_type, doc_number, updated_at FROM fiscal_identities WHERE customer_id = $1::text`),
      invoices: await q(`SELECT status, nfse_number, access_key, amount_brl_cents, paid_at, issued_at, canceled_at FROM nfse_documents WHERE user_id = $1`),
    };
  }

  /**
   * Eliminação: apaga a conta e os dados de estudo. Registros de pagamento são mantidos
   * desvinculados de dados pessoais, por obrigação legal/fiscal (LGPD art. 16, I).
   */
  @Delete() @HttpCode(204) @RateLimit({ limit: 3, windowSec: 3600, key: 'user' })
  async remove(@CurrentUser() u: JwtUser, @Body() dto: DeleteDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.checkPassword(u.sub, dto.password);
    await this.auth.revokeAll(u.sub);
    await this.db.transaction(async (m) => {
      const p = [u.sub];
      await m.query(`DELETE FROM answers WHERE "userId" = $1`, p);
      await m.query(`DELETE FROM card_reviews WHERE "userId" = $1`, p);
      await m.query(`DELETE FROM decks WHERE "ownerId" = $1`, p);
      await m.query(`DELETE FROM exams WHERE "userId" = $1`, p);
      await m.query(`DELETE FROM plan_enrollments WHERE "userId" = $1`, p);
      await m.query(`UPDATE subscriptions SET "userId" = 'deleted-user' WHERE "userId" = $1`, p);
      // Notas fiscais emitidas são mantidas (guarda legal mínima de 5 anos); o cadastro fiscal é apagado.
      await m.query(`DELETE FROM fiscal_identities WHERE customer_id = $1::text`, p);
      await m.query(`DELETE FROM users WHERE id = $1`, p);
    });
    await this.redis.client.zrem('ranking:xp', u.sub).catch(() => undefined);
    await this.redis.client.del(`streak:${u.sub}`, `stats:${u.sub}`).catch(() => undefined);
    await this.auth.logout(req, res);
    securityEvent('account.deleted', { user: u.sub });
  }
}

@Module({ imports: [TypeOrmModule.forFeature([User]), AuthModule], controllers: [AccountController] })
export class AccountModule {}
