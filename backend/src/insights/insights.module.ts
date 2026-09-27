/**
 * Console de administração: rastreador de marketing, relatórios (visão geral, marketing, mapa de calor, visitantes,
 * assinaturas), suporte e auditoria. Port de faelith-web (analytics.rs, admin_billing.rs, admin.rs, audit_store.rs).
 */
import {
  BadRequestException, Body, ConflictException, Controller, Get, Headers, HttpCode, Ip, Module, NotFoundException, Param,
  ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { DataSource, ILike, Repository } from 'typeorm';
import { AuthModule, AuthService } from '../auth/auth.module';
import { AdminOnly, CurrentUser, JwtUser, Public } from '../common/auth';
import { isProd } from '../config/env';
import { Subscription, User } from '../database/entities';
import { planById, PLANS } from '../billing/plans';
import { BillingModule, BillingService } from '../billing/billing.module';
import { RedisService } from '../redis/redis.module';
import { RateLimit } from '../security/rate-limit';
import {
  beaconRows, BeaconBody, cleanPath, HEATMAP_CLICK_CAP, intentJson, isBot, matches, MAX_BEACON_BYTES, overviewJson, pageJson,
  RangeQuery, referrerHost, REPORT_ROW_CAP, resolveRange, segDevice, segmentClicks, SUBSCRIBE_PREFIX, Tally, visitorRollups,
} from './analytics';
import { AnalyticsStore } from './analytics-store';
import { AdminCoreModule, AuditService, ReasonDto, ReauthDto, ReauthService } from './admin-core';
import { mrrSeries, rate, resolveTax, SubRow, subscriptionsJson, TaxQuery } from './business';

const DAY = 86_400_000;

// ---------------- carga de dados ----------------

async function loadSubs(db: DataSource): Promise<SubRow[]> {
  const rows: Record<string, unknown>[] = await db.query(
    `SELECT id, "userId", "planId", "paymentMethod", installments, amount, status, "createdAt", "paidAt", "startsAt", "expiresAt",
            "canceledAt", "grantedBy", "utmSource", "utmCampaign", lp, "couponCode", discount
       FROM subscriptions WHERE "userId" <> 'deleted-user' OR "paidAt" IS NOT NULL ORDER BY "createdAt" DESC LIMIT 200000`);
  const d = (v: unknown) => (v ? new Date(v as string) : null);
  return rows.map((r) => ({
    id: r.id as string, userId: r.userId as string, planId: r.planId as string, paymentMethod: r.paymentMethod as string,
    installments: Number(r.installments), amount: Number(r.amount), status: r.status as string, createdAt: new Date(r.createdAt as string),
    paidAt: d(r.paidAt), startsAt: d(r.startsAt), expiresAt: d(r.expiresAt), canceledAt: d(r.canceledAt), grantedBy: (r.grantedBy as string) ?? null,
    utmSource: (r.utmSource as string) ?? null, utmCampaign: (r.utmCampaign as string) ?? null, lp: (r.lp as string) ?? null,
    couponCode: (r.couponCode as string) ?? null, discount: Number(r.discount ?? 0),
  }));
}

// ---------------- rastreador (POST /api/t) ----------------

@Controller()
class TrackerController {
  private store: AnalyticsStore;
  constructor(@InjectDataSource() db: DataSource, private jwt: JwtService) { this.store = new AnalyticsStore(db); }

  /** Beacon do rastreador. Sempre 204 para beacons aceitos ou descartados silenciosamente. */
  @Public() @Post('t') @HttpCode(204) @RateLimit({ limit: 900, windowSec: 600 })
  async collect(@Body() raw: unknown, @Headers('user-agent') ua?: string, @Headers('authorization') auth?: string) {
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {});
    if (Buffer.byteLength(text) > MAX_BEACON_BYTES) throw new BadRequestException();
    if (isBot(ua)) return;
    let body: BeaconBody;
    try { body = JSON.parse(text); } catch { throw new BadRequestException(); }
    if (!body || typeof body !== 'object') throw new BadRequestException();
    const path = cleanPath(body.path);
    if (!path) return;
    let userId: string | null = null;
    if (body.consent === true && auth?.startsWith('Bearer ')) {
      try { userId = this.jwt.verify<JwtUser>(auth.slice(7), { algorithms: ['HS256'] }).sub; } catch { /* anônimo */ }
    }
    const { view, clicks } = beaconRows(body, path, userId, new Date());
    await this.store.upsertPageview(view).catch(() => undefined);
    await this.store.insertClicks(clicks).catch(() => undefined);
  }
}

// ---------------- relatórios ----------------

class ReportQuery implements RangeQuery, TaxQuery {
  @IsOptional() @IsString() from?: string; @IsOptional() @IsString() to?: string; @IsOptional() @IsString() path?: string;
  @IsOptional() @IsString() device?: string; @IsOptional() @IsString() source?: string; @IsOptional() @IsString() campaign?: string;
  @IsOptional() @IsString() lp?: string; @IsOptional() @IsString() revenue_tax?: string; @IsOptional() @IsString() profit_tax?: string;
  @IsOptional() @IsString() payment_fee?: string; @IsOptional() @IsString() monthly_cost?: string;
}

@Controller('admin')
class ReportsController {
  private store: AnalyticsStore;
  constructor(@InjectDataSource() private db: DataSource) { this.store = new AnalyticsStore(db); }

  private loadViews(from: Date, to: Date) { return this.store.pageviewsBetween(from, to, REPORT_ROW_CAP); }

  /** Portão do console (o front só renderiza depois disso). */
  @AdminOnly() @Get('me')
  me(@CurrentUser() u: JwtUser) { return { email: u.email, name: u.name, totp: u.mfa === 'totp' }; }

  /** Visão geral do negócio: MRR/ARR, receita, funil, engajamento. */
  @AdminOnly() @Get('overview')
  async overview(@Query() q: ReportQuery) {
    const { from, to } = resolveRange(q);
    const now = new Date();
    const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const subs = await loadSubs(this.db);
    const series = mrrSeries(subs, from, to);
    const prevSeries = mrrSeries(subs, prevFrom, from);
    const sum = (arr: { revenue_cents: number }[]) => arr.reduce((a, x) => a + x.revenue_cents, 0);
    const report = subscriptionsJson(subs, new Map(), new Map(), now, from, to, resolveTax({}));
    const [[users], [prevUsers]] = await Promise.all([
      this.db.query(`SELECT count(*)::int AS signups, count(*) FILTER (WHERE "emailVerifiedAt" IS NOT NULL)::int AS verified,
          count(*) FILTER (WHERE EXISTS (SELECT 1 FROM subscriptions s WHERE s."userId" = users.id::text))::int AS checkout,
          count(*) FILTER (WHERE EXISTS (SELECT 1 FROM subscriptions s WHERE s."userId" = users.id::text AND s."paidAt" IS NOT NULL AND s."grantedBy" IS NULL))::int AS paid,
          count(*) FILTER (WHERE "twoFactorMethod" IS NOT NULL)::int AS mfa
        FROM users WHERE role = 'student' AND "createdAt" >= $1 AND "createdAt" < $2`, [from, to]),
      this.db.query(`SELECT count(*)::int AS signups FROM users WHERE role = 'student' AND "createdAt" >= $1 AND "createdAt" < $2`, [prevFrom, from]),
    ]);
    const activity = `(SELECT "userId", "createdAt" AS at FROM answers UNION ALL SELECT "userId", "startedAt" AS at FROM exams)`;
    const [eng] = await this.db.query(`SELECT
        count(DISTINCT "userId") FILTER (WHERE at >= now() - interval '1 day')::int AS dau,
        count(DISTINCT "userId") FILTER (WHERE at >= now() - interval '7 days')::int AS wau,
        count(DISTINCT "userId") FILTER (WHERE at >= now() - interval '30 days')::int AS mau
      FROM ${activity} a WHERE at >= now() - interval '30 days'`);
    const daily: { day: string; signups: number; active: number; answers: number }[] = await this.db.query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day,
          (SELECT count(*)::int FROM users u WHERE u.role = 'student' AND u."createdAt" >= d AND u."createdAt" < d + interval '1 day') AS signups,
          (SELECT count(DISTINCT a."userId")::int FROM ${activity} a WHERE a.at >= d AND a.at < d + interval '1 day') AS active,
          (SELECT count(*)::int FROM answers x WHERE x."createdAt" >= d AND x."createdAt" < d + interval '1 day') AS answers
        FROM generate_series(date_trunc('day', $1::timestamptz), $2::timestamptz - interval '1 second', interval '1 day') d ORDER BY d`, [from, to]);
    const [totals] = await this.db.query(`SELECT (SELECT count(*)::int FROM users WHERE role = 'student') AS users,
        (SELECT count(*)::int FROM answers WHERE "createdAt" >= $1 AND "createdAt" < $2) AS answers,
        (SELECT count(*)::int FROM exams WHERE "finishedAt" >= $1 AND "finishedAt" < $2) AS exams`, [from, to]);
    const [visits] = await this.db.query(`SELECT count(*)::int AS views, count(DISTINCT visitor_id)::int AS visitors
        FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2 AND path = '/'`, [from, to]);
    const revenue = sum(series), prevRevenue = sum(prevSeries);
    const mrrStart = series[0]?.mrr_cents ?? 0;
    return {
      from: from.toISOString(), to: to.toISOString(),
      kpis: {
        mrr_cents: report.mrr_cents, arr_cents: report.arr_cents, mrr_growth_pct: mrrStart ? Math.round(((report.mrr_cents - mrrStart) * 1000) / mrrStart) / 10 : null,
        paying: report.paying, arpa_cents: report.arpa_cents, revenue_cents: revenue, prev_revenue_cents: prevRevenue,
        new_subs: report.new_in_range, canceled: report.canceled_in_range, renewing_30d: report.renewing_30d,
        signups: users.signups, prev_signups: prevUsers.signups, verified_rate: rate(users.verified, users.signups),
        signup_to_paid: rate(users.paid, users.signups), mfa_rate: rate(users.mfa, users.signups),
        users_total: totals.users, answers: totals.answers, exams: totals.exams,
        dau: eng.dau, wau: eng.wau, mau: eng.mau, stickiness: rate(eng.dau, eng.mau),
        refund_rate: report.refund.refund_rate,
      },
      funnel: [
        { name: 'Visitas à página inicial', value: visits.views },
        { name: 'Cadastros', value: users.signups },
        { name: 'E-mail confirmado', value: users.verified },
        { name: 'Iniciaram checkout', value: users.checkout },
        { name: 'Assinaram', value: users.paid },
      ],
      series: series.map((s, i) => ({ ...s, ...daily[i] })),
      plans: report.plans,
    };
  }

  /** Marketing: totais, série diária, páginas, fontes, campanhas, dispositivos, intenção de assinatura. */
  @AdminOnly() @Get('analytics/overview')
  async analyticsOverview(@Query() q: ReportQuery) {
    const { from, to } = resolveRange(q);
    const views = (await this.loadViews(from, to)).filter((v) => matches(q, v));
    const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const previous = (await this.loadViews(prevFrom, from)).filter((v) => matches(q, v));
    const intents = await this.store.clicksWithPrefix(SUBSCRIBE_PREFIX, from, to, REPORT_ROW_CAP).catch(() => []);
    const prev = new Tally();
    previous.forEach((v) => prev.add(v));
    return {
      ...overviewJson(views, from, to),
      subscribe_intent: intentJson(segmentClicks(q, intents, views)),
      previous: { from: prevFrom.toISOString(), totals: prev.toJson('previous'), anonymous_views: previous.filter((v) => !v.visitorId).length },
    };
  }

  /** Mapa de calor de uma página. */
  @AdminOnly() @Get('analytics/page')
  async page(@Query() q: ReportQuery) {
    const { from, to } = resolveRange(q);
    const path = cleanPath(q.path);
    if (!path) throw new BadRequestException('o caminho deve ser de uma página pública');
    const views = (await this.loadViews(from, to)).filter((v) => matches(q, v));
    const clicks = segmentClicks(q, await this.store.clicksForPath(path, from, to, segDevice(q), HEATMAP_CLICK_CAP), views);
    return pageJson(path, views, clicks);
  }

  /** Visitantes que consentiram, ativos no período. */
  @AdminOnly() @Get('analytics/visitors')
  async visitors(@Query() q: ReportQuery) {
    const { from, to } = resolveRange(q);
    const rows = visitorRollups((await this.loadViews(from, to)).filter((v) => matches(q, v)));
    const ids = [...new Set(rows.map(([, r]) => r.userId).filter(Boolean))] as string[];
    const emails: { id: string; email: string }[] = ids.length ? await this.db.query(`SELECT id, email FROM users WHERE id = ANY($1::uuid[])`, [ids]) : [];
    const byId = new Map(emails.map((e) => [e.id, e.email]));
    return {
      visitors: rows.map(([id, r]) => ({
        visitor_id: id, first_seen: r.firstSeen?.toISOString() ?? null, last_seen: r.lastSeen?.toISOString() ?? null, first_source: r.firstSource,
        views: r.views, sessions: r.sessions.size, pages: r.pages.size, active_ms: r.activeMs, clicks: r.clicks, email: r.userId ? byId.get(r.userId) ?? null : null,
      })),
    };
  }

  /** Jornada completa de um visitante que consentiu. */
  @AdminOnly() @Get('analytics/visitors/:id')
  async visitor(@Param('id', ParseUUIDPipe) id: string) {
    const views = await this.store.pageviewsForVisitor(id, 2000);
    const clicks = await this.store.clicksForPageviews(views.map((v) => v.id));
    const userId = views.find((v) => v.userId)?.userId;
    const [user] = userId ? await this.db.query(`SELECT email FROM users WHERE id = $1`, [userId]) : [];
    return {
      visitor_id: id, email: user?.email ?? null,
      pageviews: views.map((v) => ({
        id: v.id, path: v.path, started_at: v.startedAt.toISOString(), last_seen_at: v.lastSeenAt.toISOString(), active_ms: v.activeMs,
        max_scroll: v.maxScroll, clicks: v.clicks, device: v.device, session_id: v.sessionId, referrer: v.referrer ? referrerHost(v) : null,
        utm_source: v.utm.source, utm_campaign: v.utm.campaign, lp: v.lp,
      })),
      clicks: clicks.map((c) => ({ pageview_id: c.pageviewId, path: c.path, label: c.label, at: c.at.toISOString() })),
    };
  }

  /** Assinaturas: MRR/ARR, mix por plano, funil de checkout, atribuição, lucro real, compradores, reembolsos. */
  @AdminOnly() @Get('subscriptions')
  async subscriptions(@Query() q: ReportQuery) {
    const { from, to } = resolveRange(q);
    const subs = await loadSubs(this.db);
    const userIds = [...new Set(subs.map((s) => s.userId))].filter((x) => /^[0-9a-f-]{36}$/.test(x));
    const users: { id: string; university: string | null }[] = userIds.length ? await this.db.query(`SELECT id, university FROM users WHERE id = ANY($1::uuid[])`, [userIds]) : [];
    const ids: { customer_id: string; doc_type: string }[] = await this.db.query(`SELECT customer_id, doc_type FROM fiscal_identities`);
    return subscriptionsJson(subs, new Map(users.map((u) => [u.id, u])), new Map(ids.map((i) => [i.customer_id, i.doc_type])), new Date(), from, to, resolveTax(q));
  }
}

// ---------------- suporte (port de admin.rs) ----------------

class GrantDto extends ReasonDto {
  @IsIn(PLANS.map((p) => p.id)) planId: string;
  @IsOptional() @IsInt() @Min(1) @Max(12) months?: number;
}
class RevokeDto extends ReasonDto { @IsString() subscriptionId: string }

@Controller('admin/users')
class SupportController {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Subscription) private subs: Repository<Subscription>,
    @InjectDataSource() private db: DataSource,
    private billing: BillingService,
    private auth: AuthService,
    private audit: AuditService,
    private reauth: ReauthService,
    private redis: RedisService,
  ) {}

  /** Busca por e-mail (parcial), nome ou id. */
  @AdminOnly() @Get('search')
  async search(@Query('q') q = '') {
    const term = q.trim();
    if (term.length < 2) return [];
    const where = /^[0-9a-f-]{36}$/i.test(term)
      ? [{ id: term }]
      : [{ email: ILike(`%${term.replace(/[%_\\]/g, '\\$&')}%`) }, { name: ILike(`%${term.replace(/[%_\\]/g, '\\$&')}%`) }];
    const found = await this.users.find({ where, take: 20, order: { createdAt: 'DESC' } });
    return found.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.createdAt, suspended: !!u.suspendedAt }));
  }

  /** Detalhe de uma conta: plano, assinaturas, segurança, uso, dados fiscais. */
  @AdminOnly() @Get(':id')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const u = await this.users.findOneBy({ id });
    if (!u) throw new NotFoundException();
    const subs = await this.subs.find({ where: { userId: id }, order: { createdAt: 'DESC' } });
    const limits = await this.billing.limits({ sub: id, role: u.role });
    const [usage] = await this.db.query(`SELECT
        (SELECT count(*)::int FROM answers WHERE "userId" = $1) AS answers,
        (SELECT count(*)::int FROM answers WHERE "userId" = $1 AND correct) AS correct,
        (SELECT count(*)::int FROM exams WHERE "userId" = $1 AND "finishedAt" IS NOT NULL) AS exams,
        (SELECT count(*)::int FROM card_reviews WHERE "userId" = $1) AS cards,
        (SELECT max(at) FROM (SELECT max("createdAt") AS at FROM answers WHERE "userId" = $1 UNION ALL SELECT max("startedAt") FROM exams WHERE "userId" = $1) x) AS last_activity,
        (SELECT count(*)::int FROM nfse_documents WHERE user_id = $1::uuid AND status = 'issued') AS invoices`, [id]);
    const [fiscal] = await this.db.query(`SELECT doc_type, doc_number FROM fiscal_identities WHERE customer_id = $1`, [id]);
    const recovery = await this.db.query(`SELECT coalesce(jsonb_array_length("recoveryCodes"), 0)::int AS n FROM users WHERE id = $1`, [id]);
    const now = new Date();
    return {
      account: { id: u.id, name: u.name, email: u.email, role: u.role, university: u.university, semester: u.semester, created_at: u.createdAt, xp: u.xp },
      security: { email_verified: !!u.emailVerifiedAt, two_factor: u.twoFactorMethod ?? null, recovery_codes: recovery[0]?.n ?? 0, suspended_at: u.suspendedAt ?? null, suspend_reason: u.suspendReason ?? null },
      plan: limits,
      subscriptions: subs.map((s) => ({
        id: s.id, plan: planById(s.planId)?.name ?? s.planId, planId: s.planId, status: s.status, method: s.paymentMethod, installments: s.installments,
        amount_cents: s.amount, paid_at: s.paidAt, starts_at: s.startsAt, expires_at: s.expiresAt, canceled_at: s.canceledAt, granted_by: s.grantedBy,
        live: s.status === 'active' && !!s.expiresAt && s.expiresAt > now,
        refund_window_until: s.paidAt && !s.grantedBy ? new Date(s.paidAt.getTime() + 7 * DAY) : null,
        attribution: [s.utmSource, s.utmCampaign, s.lp].filter(Boolean).join(' · ') || null,
      })),
      usage: { ...usage, accuracy: rate(usage.correct, usage.answers) },
      fiscal: fiscal ? { doc_type: fiscal.doc_type, doc_number: `***${String(fiscal.doc_number).slice(-2)}` } : null,
    };
  }

  /** Concede um plano de cortesia (sem cobrança, não entra no MRR). */
  @AdminOnly() @Post(':id/grant') @RateLimit({ limit: 20, windowSec: 600, key: 'user' })
  async grant(@CurrentUser() admin: JwtUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GrantDto) {
    await this.reauth.require(admin, dto);
    if (!(await this.users.existsBy({ id }))) throw new NotFoundException();
    const plan = planById(dto.planId)!;
    const start = new Date();
    const expires = new Date(start);
    if (dto.months) expires.setMonth(expires.getMonth() + dto.months); else expires.setFullYear(expires.getFullYear() + plan.accessYears);
    const sub = await this.subs.save(this.subs.create({
      userId: id, planId: plan.id, paymentMethod: 'pix', installments: 1, amount: 0, status: 'active', provider: 'grant',
      paidAt: start, startsAt: start, expiresAt: expires, grantedBy: admin.email,
    }));
    await this.audit.record(admin, 'user.grant_plan', id, { plan: plan.id, subscription: sub.id, until: expires.toISOString(), reason: dto.reason });
    return { ok: true };
  }

  /** Encerra uma assinatura (não estorna no Mercado Pago; o estorno é feito no painel do provedor). */
  @AdminOnly() @Post(':id/revoke') @RateLimit({ limit: 20, windowSec: 600, key: 'user' })
  async revoke(@CurrentUser() admin: JwtUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RevokeDto) {
    await this.reauth.require(admin, dto);
    const sub = await this.subs.findOneBy({ id: dto.subscriptionId, userId: id });
    if (!sub) throw new NotFoundException();
    if (sub.status !== 'active') throw new ConflictException('a assinatura não está ativa');
    sub.status = 'canceled';
    sub.canceledAt = new Date();
    await this.subs.save(sub);
    await this.audit.record(admin, 'user.revoke_plan', id, { subscription: sub.id, plan: sub.planId, reason: dto.reason });
    return { ok: true };
  }

  /** Suspende a conta: bloqueia login e derruba as sessões. */
  @AdminOnly() @Post(':id/suspend') @RateLimit({ limit: 20, windowSec: 600, key: 'user' })
  async suspend(@CurrentUser() admin: JwtUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    await this.reauth.require(admin, dto);
    if (id === admin.sub) throw new BadRequestException('você não pode suspender a própria conta');
    const u = await this.users.findOneBy({ id });
    if (!u) throw new NotFoundException();
    await this.users.update(id, { suspendedAt: new Date(), suspendReason: dto.reason });
    await this.auth.revokeAll(id);
    await this.audit.record(admin, 'user.suspend', id, { reason: dto.reason });
    return { ok: true };
  }

  @AdminOnly() @Post(':id/unsuspend') @RateLimit({ limit: 20, windowSec: 600, key: 'user' })
  async unsuspend(@CurrentUser() admin: JwtUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReauthDto) {
    await this.reauth.require(admin, dto);
    await this.users.update(id, { suspendedAt: null, suspendReason: null });
    await this.audit.record(admin, 'user.unsuspend', id);
    return { ok: true };
  }

  /** Remove o 2FA de quem perdeu o celular e os códigos de recuperação (após verificar a identidade por outro meio). */
  @AdminOnly() @Post(':id/reset-2fa') @RateLimit({ limit: 20, windowSec: 600, key: 'user' })
  async reset2fa(@CurrentUser() admin: JwtUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    await this.reauth.require(admin, dto);
    await this.users.update(id, { twoFactorMethod: null, totpSecretEnc: null, recoveryCodes: null, twoFactorEnabledAt: null });
    await this.auth.revokeAll(id);
    await this.redis.client.del(`totp-used:${id}`).catch(() => undefined);
    await this.audit.record(admin, 'user.reset_2fa', id, { reason: dto.reason });
    return { ok: true };
  }

  /** Marca o e-mail como confirmado (quando o código não chega e a identidade foi verificada). */
  @AdminOnly() @Post(':id/verify-email') @RateLimit({ limit: 20, windowSec: 600, key: 'user' })
  async verifyEmail(@CurrentUser() admin: JwtUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    await this.reauth.require(admin, dto);
    await this.users.update(id, { emailVerifiedAt: new Date() });
    await this.audit.record(admin, 'user.verify_email', id, { reason: dto.reason });
    return { ok: true };
  }
}

class CouponDto extends ReauthDto {
  @IsString() @Length(3, 32) couponCode: string;
  @IsInt() @Min(1) @Max(90) percentOff: number;
  @IsOptional() @IsArray() @IsIn(PLANS.map((p) => p.id), { each: true }) planIds?: string[];
  @IsOptional() @IsInt() @Min(1) maxRedemptions?: number;
  @IsOptional() @IsDateString() expiresAt?: string;
}

/** Cupons de desconto (marketing): criação exige reautenticação; tudo fica na auditoria. */
@Controller('admin/coupons')
class CouponsController {
  constructor(private billing: BillingService, private audit: AuditService, private reauth: ReauthService) {}

  @AdminOnly() @Get() list() { return this.billing.coupons.list(); }

  @AdminOnly() @Post() @RateLimit({ limit: 20, windowSec: 600, key: 'user' })
  async create(@CurrentUser() admin: JwtUser, @Body() dto: CouponDto) {
    await this.reauth.require(admin, dto);
    const code = await this.billing.coupons.create({ code: dto.couponCode, percentOff: dto.percentOff, planIds: dto.planIds ?? null, maxRedemptions: dto.maxRedemptions ?? null, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null, createdBy: admin.email });
    await this.audit.record(admin, 'coupon.create', null, { code, percent_off: dto.percentOff, plans: dto.planIds ?? 'todos', max: dto.maxRedemptions ?? null, expires_at: dto.expiresAt ?? null });
    return { code };
  }

  @AdminOnly() @Post(':code/:state') @RateLimit({ limit: 30, windowSec: 600, key: 'user' })
  async toggle(@CurrentUser() admin: JwtUser, @Param('code') code: string, @Param('state') state: string) {
    if (state !== 'enable' && state !== 'disable') throw new NotFoundException();
    await this.billing.coupons.setActive(code, state === 'enable');
    await this.audit.record(admin, state === 'enable' ? 'coupon.enable' : 'coupon.disable', null, { code: code.toUpperCase() });
    return { ok: true };
  }
}

@Controller('admin/audit')
class AuditController {
  constructor(private audit: AuditService) {}
  @AdminOnly() @Get() list() { return this.audit.list(); }
}

@Module({
  imports: [TypeOrmModule.forFeature([User, Subscription]), AuthModule, BillingModule, AdminCoreModule],
  controllers: [TrackerController, ReportsController, SupportController, CouponsController, AuditController],
})
export class InsightsModule {}
