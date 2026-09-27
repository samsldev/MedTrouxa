import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Module, Patch, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource, InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import type { Request, Response } from 'express';
import { DataSource, Repository } from 'typeorm';
import { AuthModule, AuthService } from '../auth/auth.module';
import { CurrentUser, JwtUser } from '../common/auth';
import { User } from '../database/entities';
import { RedisService } from '../redis/redis.module';
import { securityEvent } from '../security/logging';
import { hashPassword, passwordProblem, verifyPassword } from '../security/password';
import { RateLimit } from '../security/rate-limit';

class ProfileDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @MaxLength(160) university?: string;
  @IsOptional() @IsInt() @Min(1) @Max(12) semester?: number;
}
class PasswordDto { @IsString() @MaxLength(128) currentPassword: string; @IsString() @MaxLength(128) newPassword: string }
class DeleteDto { @IsString() @MaxLength(128) password: string }

/** Direitos do titular (LGPD art. 18): acesso, correção, portabilidade e eliminação. */
@Controller('account')
class AccountController {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectDataSource() private db: DataSource,
    private auth: AuthService,
    private redis: RedisService,
  ) {}

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
