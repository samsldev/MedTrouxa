/**
 * Base do console de administração: auditoria (port de audit_store.rs) e reautenticação das ações sensíveis.
 * Toda mutação do console exige senha + segundo fator (se ativo) e é gravada no log de auditoria.
 */
import { BadRequestException, Injectable, Module, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource, InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { JwtUser } from '../common/auth';
import { User } from '../database/entities';
import { securityEvent } from '../security/logging';
import { verifyPassword } from '../security/password';
import { MfaMethod, TwoFactorService } from '../security/twofactor';

/** Prova de reautenticação enviada com toda ação do console. */
export class ReauthDto {
  @IsString() @MaxLength(128) password: string;
  @IsOptional() @IsIn(['totp', 'email', 'recovery']) method?: MfaMethod;
  @IsOptional() @IsString() @Length(6, 12) code?: string;
}

/** Ação com motivo obrigatório (fica na auditoria). */
export class ReasonDto extends ReauthDto {
  @IsString() @Length(5, 500) reason: string;
}

export interface AuditEntry { admin_email: string; action: string; target_user: string | null; detail: Record<string, unknown>; at: string }

@Injectable()
export class AuditService {
  constructor(@InjectDataSource() private db: DataSource) {}

  async record(admin: JwtUser, action: string, targetUser: string | null, detail: Record<string, unknown> = {}) {
    await this.db.query(`INSERT INTO admin_audit (admin_email, action, target_user, detail) VALUES ($1, $2, $3, $4)`,
      [admin.email, action, targetUser, JSON.stringify(detail)]);
    securityEvent(`admin.${action}`, { admin: admin.sub, target: targetUser });
  }

  async list(limit = 500): Promise<AuditEntry[]> {
    const rows: Record<string, unknown>[] = await this.db.query(
      `SELECT admin_email, action, target_user, detail, at FROM admin_audit ORDER BY at DESC LIMIT $1`, [limit]);
    return rows.map((r) => ({ admin_email: r.admin_email as string, action: r.action as string, target_user: (r.target_user as string) ?? null, detail: r.detail as Record<string, unknown>, at: new Date(r.at as string).toISOString() }));
  }
}

@Injectable()
export class ReauthService {
  constructor(@InjectRepository(User) private users: Repository<User>, private twoFactor: TwoFactorService) {}

  /** Exige a senha e, se o admin tiver 2FA por app, o código atual (ou um código de recuperação). */
  async require(admin: JwtUser, proof?: ReauthDto) {
    if (!proof?.password) throw new BadRequestException({ message: 'Reautenticação necessária', code: 'REAUTH_REQUIRED' });
    const me = await this.users.findOne({ where: { id: admin.sub }, select: ['id', 'passwordHash', 'twoFactorMethod'] });
    if (!me || !(await verifyPassword(proof.password, me.passwordHash))) {
      securityEvent('admin.reauth_failed', { admin: admin.sub });
      throw new UnauthorizedException('Reautenticação necessária: senha incorreta');
    }
    if (me.twoFactorMethod === 'totp' || proof.method === 'recovery') {
      const method = proof.method ?? 'totp';
      if (!proof.code || !(await this.twoFactor.verify(admin.sub, method, proof.code))) {
        throw new UnauthorizedException('Reautenticação necessária: código do app autenticador inválido');
      }
    }
  }
}

@Module({ imports: [TypeOrmModule.forFeature([User]), AuthModule], providers: [AuditService, ReauthService], exports: [AuditService, ReauthService] })
export class AdminCoreModule {}
