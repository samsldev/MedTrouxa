import { BadRequestException, Body, Controller, Get, HttpCode, Module, NotFoundException, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { AdminOnly, CurrentUser, JwtUser } from '../common/auth';
import { AdminCoreModule, AuditService } from '../insights/admin-core';
import { RedisService } from '../redis/redis.module';
import { RateLimit } from '../security/rate-limit';
import { rankingRef } from './ref';

const REASONS = ['ofensivo', 'incorreto', 'perigoso', 'outro'] as const;

class ReportDto {
  @IsIn(['ai_reply', 'ranking_name']) kind: 'ai_reply' | 'ranking_name';
  @IsIn(REASONS) reason: (typeof REASONS)[number];
  /** Texto denunciado (resposta da IA). */
  @IsOptional() @IsString() @MaxLength(8000) content?: string;
  /** Referência opaca do usuário no ranking. */
  @IsOptional() @IsString() @Length(10, 40) ref?: string;
}
class ResolveDto { @IsIn(['dismiss', 'resolve', 'reset_name']) action: 'dismiss' | 'resolve' | 'reset_name' }

/** Denúncia feita por um aluno (app ou site). */
@Controller('reports')
class ReportsController {
  constructor(@InjectDataSource() private db: DataSource, private redis: RedisService) {}

  @Post() @HttpCode(202) @RateLimit({ limit: 20, windowSec: 3600, key: 'user' })
  async create(@CurrentUser() u: JwtUser, @Body() dto: ReportDto) {
    let target: string | null = null;
    let content = dto.content?.trim() ?? '';
    if (dto.kind === 'ranking_name') {
      if (!dto.ref) throw new BadRequestException('Referência ausente');
      const top = await this.redis.topRanking(100);
      target = top.map((t) => t.userId).find((id) => rankingRef(id) === dto.ref) ?? null;
      if (!target) throw new NotFoundException('Esse aluno não está mais no ranking');
      const [row] = await this.db.query(`SELECT name FROM users WHERE id = $1`, [target]);
      content = row?.name ?? '';
    } else if (!content) throw new BadRequestException('Conteúdo ausente');
    await this.db.query(`INSERT INTO content_reports (reporter_id, kind, target_user, content, reason) VALUES ($1, $2, $3, $4, $5)`,
      [u.sub, dto.kind, target, content.slice(0, 8000), dto.reason]);
    return { message: 'Obrigado. Nossa equipe vai analisar a denúncia.' };
  }
}

/** Fila de moderação no console. */
@Controller('admin/reports')
class AdminReportsController {
  constructor(@InjectDataSource() private db: DataSource, private audit: AuditService) {}

  @AdminOnly() @Get()
  list(@Query('status') status = 'open') {
    return this.db.query(`SELECT r.id, r.kind, r.content, r.reason, r.status, r.created_at, r.resolved_by, r.resolved_at, r.target_user,
        t.email AS target_email, t.name AS target_name, rep.email AS reporter_email
      FROM content_reports r LEFT JOIN users t ON t.id = r.target_user LEFT JOIN users rep ON rep.id = r.reporter_id
      WHERE ($1 = 'all' OR r.status = $1) ORDER BY r.created_at DESC LIMIT 300`, [['open', 'dismissed', 'resolved', 'all'].includes(status) ? status : 'open']);
  }

  @AdminOnly() @Post(':id') @RateLimit({ limit: 60, windowSec: 600, key: 'user' })
  async resolve(@CurrentUser() admin: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ResolveDto) {
    const [r] = await this.db.query(`SELECT id, kind, target_user FROM content_reports WHERE id = $1`, [id]);
    if (!r) throw new NotFoundException();
    if (dto.action === 'reset_name') {
      if (r.kind !== 'ranking_name' || !r.target_user) throw new BadRequestException('Só vale para nomes do ranking');
      await this.db.query(`UPDATE users SET name = 'Estudante' WHERE id = $1`, [r.target_user]);
      await this.audit.record(admin, 'user.reset_name', r.target_user, { report: id });
    }
    await this.db.query(`UPDATE content_reports SET status = $2, resolved_by = $3, resolved_at = now() WHERE id = $1`,
      [id, dto.action === 'dismiss' ? 'dismissed' : 'resolved', admin.email]);
    await this.audit.record(admin, `report.${dto.action}`, r.target_user, { report: id, kind: r.kind });
    return { ok: true };
  }
}

@Module({ imports: [AdminCoreModule], controllers: [ReportsController, AdminReportsController] })
export class ModerationModule {}
