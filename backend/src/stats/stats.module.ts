import { Controller, Get, Module } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CurrentUser, JwtUser } from '../common/auth';
import { RedisService } from '../redis/redis.module';

@Controller('stats')
class StatsController {
  constructor(@InjectDataSource() private db: DataSource, private redis: RedisService) {}

  @Get('me')
  async me(@CurrentUser() u: JwtUser) {
    const data = await this.redis.cached(`stats:${u.sub}`, 120, async () => {
      const [totals] = await this.db.query(
        `SELECT count(*)::int AS answered, count(*) FILTER (WHERE correct)::int AS correct FROM answers WHERE "userId" = $1`, [u.sub]);
      const bySubject = await this.db.query(
        `SELECT s.id, s.name, count(a.id)::int AS answered, count(a.id) FILTER (WHERE a.correct)::int AS correct
           FROM answers a JOIN questions q ON q.id = a."questionId" JOIN topics t ON t.id = q."topicId"
           JOIN subjects s ON s.id = t."subjectId" WHERE a."userId" = $1 GROUP BY s.id ORDER BY s.name`, [u.sub]);
      const daily = await this.db.query(
        `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(a.id)::int AS answered
           FROM generate_series(current_date - 13, current_date, '1 day') d
           LEFT JOIN answers a ON a."userId" = $1 AND a."createdAt"::date = d::date GROUP BY d ORDER BY d`, [u.sub]);
      const [cards] = await this.db.query(
        `SELECT count(*)::int AS studied, count(*) FILTER (WHERE "dueAt" <= now())::int AS due FROM card_reviews WHERE "userId" = $1`, [u.sub]);
      const [exams] = await this.db.query(
        `SELECT count(*)::int AS done, coalesce(round(avg(score)), 0)::int AS "avgScore" FROM exams WHERE "userId" = $1 AND "finishedAt" IS NOT NULL`, [u.sub]);
      return { ...totals, bySubject, daily, cards, exams };
    });
    const [xp, streak] = await Promise.all([this.redis.client.zscore('ranking:xp', u.sub).catch(() => null), this.redis.streak(u.sub)]);
    return { ...data, xp: Number(xp ?? 0), streak };
  }

  @Get('ranking')
  async ranking(@CurrentUser() u: JwtUser) {
    const top = await this.redis.topRanking(20);
    if (!top.length) return [];
    const users: { id: string; name: string; university: string | null }[] = await this.db.query(
      `SELECT id, name, university FROM users WHERE id = ANY($1::uuid[])`, [top.map((t) => t.userId)]);
    const byId = new Map(users.map((x) => [x.id, x]));
    // Minimização (LGPD): só primeiro nome + inicial do sobrenome; o id é devolvido só para o próprio usuário
    const short = (n: string) => { const [a, ...r] = n.trim().split(/\s+/); return r.length ? `${a} ${r[r.length - 1][0]}.` : a; };
    return top.filter((t) => byId.has(t.userId)).map((t, i) => {
      const x = byId.get(t.userId)!;
      return { position: i + 1, xp: t.xp, name: short(x.name), university: x.university, me: t.userId === u.sub };
    });
  }
}

@Module({ controllers: [StatsController] })
export class StatsModule {}
