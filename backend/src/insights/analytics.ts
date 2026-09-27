/**
 * Rastreador de marketing e relatórios. Port de faelith-web/src/analytics.rs.
 *
 * - POST /api/t recebe beacons (sendBeacon, sem token CSRF possível); entradas são limitadas, bots e caminhos
 *   não públicos são descartados, e o endpoint tem limite por IP
 * - Sem consentimento o beacon é guardado anonimamente: ids de visitante, sessão e usuário são descartados
 * - Nenhum IP ou user-agent é persistido
 * - Períodos são dias inteiros (YYYY-MM-DD) ou instantes RFC 3339 (o atalho de 24h)
 * - Relatórios aceitam filtros de segmento (dispositivo, fonte UTM, campanha UTM, variação de landing); a visão geral
 *   também devolve o período anterior de mesma duração para comparação
 * - CTAs de assinatura são marcados `subscribe:<plano>`; a visão geral ranqueia essa intenção
 */
import { BadRequestException } from '@nestjs/common';
import { ATTENTION_BANDS, ClickRecord, PageviewRecord } from './analytics-store';

/** Maior beacon aceito (bytes). */
export const MAX_BEACON_BYTES = 16 * 1024;
/** Cliques aceitos por beacon. */
const MAX_CLICKS_PER_BEACON = 50;
/** Teto de tempo ativo numa visualização (6 horas). */
export const MAX_ACTIVE_MS = 6 * 60 * 60 * 1000;
/** Prefixo dos CTAs de assinatura rastreados. */
export const SUBSCRIBE_PREFIX = 'subscribe:';
/** Linhas carregadas por relatório (mantém a consulta do admin limitada). */
export const REPORT_ROW_CAP = 200_000;
/** Cliques devolvidos num mapa de calor. */
export const HEATMAP_CLICK_CAP = 5_000;
/** Visualização mais curta que isso e sem clique conta como rejeição. */
const BOUNCE_ACTIVE_MS = 10_000;

/** Páginas públicas rastreáveis do MedTrouxa (a área logada nunca é rastreada). */
const PUBLIC_PATHS = ['/', '/login', '/esqueci-senha', '/termos', '/privacidade'];
const PUBLIC_PREFIXES = ['/lp/'];

export interface BeaconBody {
  pv: string; vid?: string | null; sid?: string | null; consent?: boolean; path: string; ref?: string | null;
  utm?: Partial<Record<'source' | 'medium' | 'campaign' | 'content' | 'term', string>>; lp?: string | null; device?: string | null; lang?: string | null;
  vw?: number; vh?: number; dh?: number; active_ms?: number; max_scroll?: number; attention?: number[]; clicks?: { x: number; y: number; l?: string }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const clamp = (v: unknown, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.trunc(n))) : lo; };

/** Remove espaços, descarta vazios e limita um texto livre a `max` caracteres. */
export function clean(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const v = [...raw.trim()].slice(0, max).join('');
  return v ? v : null;
}

/** Normaliza o caminho rastreado: sem query nem fragmento, tamanho limitado, só páginas públicas. */
export function cleanPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const path = [...raw.split(/[?#]/)[0]].slice(0, 200).join('');
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p)) ? path : null;
}

/** Mantém só esquema, host e caminho do referrer (query strings podem ter dados pessoais). */
export function cleanReferrer(raw: unknown): string | null {
  const v = clean(raw, 500);
  if (!v) return null;
  try {
    const u = new URL(v);
    if (!u.hostname) return null;
    return `${u.protocol}//${u.hostname}${u.pathname}`.slice(0, 300);
  } catch {
    return null;
  }
}

/** Tipo de dispositivo; desconhecido conta como desktop. */
export const cleanDevice = (raw: unknown) => (raw === 'mobile' || raw === 'tablet' ? raw : 'desktop');

/** true para crawlers e navegadores headless, que distorceriam os números de marketing. */
export function isBot(userAgent?: string | null): boolean {
  if (!userAgent) return true;
  const a = userAgent.toLowerCase();
  return ['bot', 'crawl', 'spider', 'slurp', 'headless', 'lighthouse', 'preview'].some((m) => a.includes(m));
}

/** Monta as linhas guardadas a partir de um beacon validado; `userId` já passou pelo consentimento. */
export function beaconRows(body: BeaconBody, path: string, userId: string | null, now: Date): { view: PageviewRecord; clicks: ClickRecord[] } {
  if (!isUuid(body.pv)) throw new BadRequestException('beacon inválido');
  const device = cleanDevice(body.device);
  const activeMs = clamp(body.active_ms, 0, MAX_ACTIVE_MS);
  const attention = (Array.isArray(body.attention) ? body.attention : []).slice(0, ATTENTION_BANDS).map((ms) => clamp(ms, 0, MAX_ACTIVE_MS));
  while (attention.length < ATTENTION_BANDS) attention.push(0);
  const clicks: ClickRecord[] = (Array.isArray(body.clicks) ? body.clicks : [])
    .slice(0, MAX_CLICKS_PER_BEACON)
    .filter((c) => c && Number.isFinite(c.x) && Number.isFinite(c.y))
    .map((c) => ({
      pageviewId: body.pv, path, device, xPct: Math.min(1, Math.max(0, c.x)), yPct: Math.min(1, Math.max(0, c.y)),
      label: [...String(c.l ?? '').trim()].slice(0, 80).join(''), at: now,
    }));
  const consent = body.consent === true;
  const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
  const view: PageviewRecord = {
    id: body.pv,
    visitorId: consent && isUuid(body.vid) ? body.vid : null,
    sessionId: consent && isUuid(body.sid) ? body.sid : null,
    userId,
    path,
    referrer: cleanReferrer(body.ref),
    utm: { source: clean(utm.source, 100), medium: clean(utm.medium, 100), campaign: clean(utm.campaign, 100), content: clean(utm.content, 100), term: clean(utm.term, 100) },
    lp: clean(body.lp, 60),
    device,
    lang: clean(body.lang, 16),
    viewportW: clamp(body.vw, 0, 10_000), viewportH: clamp(body.vh, 0, 10_000), docH: clamp(body.dh, 0, 200_000),
    startedAt: now, lastSeenAt: now, activeMs, maxScroll: clamp(body.max_scroll, 0, 100), attention, clicks: clicks.length,
  };
  return { view, clicks };
}

/** Período e filtros de segmento de um relatório. */
export interface RangeQuery { from?: string; to?: string; path?: string; device?: string; source?: string; campaign?: string; lp?: string }

const f = (v?: string) => { const x = v?.trim(); return x ? x : null; };
export const segDevice = (q: RangeQuery) => { const d = f(q.device); return d && ['mobile', 'tablet', 'desktop'].includes(d) ? d : null; };
const hasSegment = (q: RangeQuery) => !!(f(q.source) || f(q.campaign) || f(q.lp));

/** true quando a visualização pertence ao segmento selecionado. */
export function matches(q: RangeQuery, v: PageviewRecord): boolean {
  const eq = (filter: string | null, value: string | null) => filter === null || value === filter;
  return eq(segDevice(q), v.device) && eq(f(q.source), v.utm.source) && eq(f(q.campaign), v.utm.campaign) && eq(f(q.lp), v.lp);
}

/** Mantém os cliques cuja visualização está no segmento (todos quando não há filtro). */
export function segmentClicks(q: RangeQuery, clicks: ClickRecord[], views: PageviewRecord[]) {
  if (!hasSegment(q) && !segDevice(q)) return clicks;
  const ids = new Set(views.map((v) => v.id));
  return clicks.filter((c) => ids.has(c.pageviewId));
}

const DAY = 86_400_000;
const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Um limite: `YYYY-MM-DD` (início do dia, ou início do dia seguinte para `to`) ou um instante RFC 3339. */
function parseBound(raw: string | undefined, endOfDay: boolean): Date | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('data inválida');
    return endOfDay ? new Date(d.getTime() + DAY) : d;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  throw new BadRequestException('as datas devem ser YYYY-MM-DD ou RFC 3339');
}

/** Resolve `[from, to)`; `to` cobre o último dia inteiro. Padrão: últimos 7 dias. */
export function resolveRange(q: RangeQuery, now = new Date()): { from: Date; to: Date } {
  const start = parseBound(q.from, false);
  const end = parseBound(q.to, true) ?? new Date(startOfUtcDay(now).getTime() + DAY);
  const from = start ?? new Date(end.getTime() - 7 * DAY);
  if (from >= end || end.getTime() - from.getTime() > 367 * DAY) {
    throw new BadRequestException('o período deve ter no máximo um ano e o início deve ser antes do fim');
  }
  return { from, to: end };
}

/** Totais acumulados de um grupo de visualizações (uma página, uma fonte, um dispositivo...). */
export class Tally {
  views = 0;
  visitors = new Set<string>();
  sessions = new Set<string>();
  activeMs = 0;
  scrollSum = 0;
  reach = [0, 0, 0, 0];
  bounces = 0;
  clicks = 0;
  clickedViews = 0;

  add(v: PageviewRecord) {
    this.views += 1;
    if (v.visitorId) this.visitors.add(v.visitorId);
    if (v.sessionId) this.sessions.add(v.sessionId);
    this.activeMs += v.activeMs;
    this.scrollSum += v.maxScroll;
    [25, 50, 75, 100].forEach((t, i) => { if (v.maxScroll >= t) this.reach[i] += 1; });
    if (v.activeMs < BOUNCE_ACTIVE_MS && v.clicks === 0) this.bounces += 1;
    this.clicks += v.clicks;
    if (v.clicks > 0) this.clickedViews += 1;
  }

  /** Percentual das visualizações com uma casa decimal. */
  pct(count: number) { return this.views === 0 ? 0 : Math.round((count * 1000) / this.views) / 10; }

  toJson(name: string) {
    const views = Math.max(1, this.views);
    return {
      name, views: this.views, visitors: this.visitors.size, sessions: this.sessions.size,
      avg_active_ms: Math.trunc(this.activeMs / views), avg_scroll: Math.trunc(this.scrollSum / views),
      reach: this.reach.map((c) => this.pct(c)), bounce_rate: this.pct(this.bounces), clicks: this.clicks, click_rate: this.pct(this.clickedViews),
    };
  }
}

/** Agrupa visualizações por `key` e devolve os `limit` maiores grupos. */
export function topGroups(views: PageviewRecord[], limit: number, key: (v: PageviewRecord) => string | null) {
  const groups = new Map<string, Tally>();
  for (const v of views) {
    const name = key(v);
    if (name === null) continue;
    if (!groups.has(name)) groups.set(name, new Tally());
    groups.get(name)!.add(v);
  }
  return [...groups.entries()].sort((a, b) => b[1].views - a[1].views || a[0].localeCompare(b[0])).slice(0, limit).map(([n, t]) => t.toJson(n));
}

/** Host do referrer, ou "(direto)" quando a visita não teve. */
export function referrerHost(v: PageviewRecord) {
  try { return v.referrer ? new URL(v.referrer).hostname.replace(/^www\./, '') : '(direto)'; } catch { return '(direto)'; }
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Relatório de visão geral a partir das visualizações cruas. */
export function overviewJson(views: PageviewRecord[], from: Date, to: Date) {
  const total = new Tally();
  let anonymous = 0;
  const days = new Map<string, { views: number; visitors: Set<string> }>();
  for (let d = startOfUtcDay(from); d < to; d = new Date(d.getTime() + DAY)) days.set(isoDay(d), { views: 0, visitors: new Set() });
  for (const v of views) {
    total.add(v);
    if (!v.visitorId) anonymous += 1;
    const k = isoDay(v.startedAt);
    if (!days.has(k)) days.set(k, { views: 0, visitors: new Set() });
    const e = days.get(k)!;
    e.views += 1;
    if (v.visitorId) e.visitors.add(v.visitorId);
  }
  return {
    from: from.toISOString(), to: to.toISOString(), truncated: views.length >= REPORT_ROW_CAP,
    totals: total.toJson('total'), anonymous_views: anonymous,
    series: [...days.entries()].sort().map(([day, e]) => ({ day, views: e.views, visitors: e.visitors.size })),
    pages: topGroups(views, 100, (v) => v.path),
    landing_pages: topGroups(views, 50, (v) => v.lp),
    referrers: topGroups(views, 20, (v) => referrerHost(v)),
    utm_sources: topGroups(views, 20, (v) => v.utm.source),
    utm_campaigns: topGroups(views, 20, (v) => v.utm.campaign),
    utm_contents: topGroups(views, 20, (v) => v.utm.content),
    devices: topGroups(views, 5, (v) => v.device),
    languages: topGroups(views, 10, (v) => v.lang),
  };
}

/** Ranqueia cliques nos CTAs de assinatura por plano e pela página em que aconteceram. */
export function intentJson(clicks: ClickRecord[]) {
  const rank = (key: (c: ClickRecord) => string) => {
    const counts = new Map<string, number>();
    for (const c of clicks) counts.set(key(c), (counts.get(key(c)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, n]) => ({ name, clicks: n }));
  };
  return {
    total: clicks.length,
    by_plan: rank((c) => c.label.slice(SUBSCRIBE_PREFIX.length).replace(/:/g, ' / ')),
    by_page: rank((c) => c.path),
  };
}

/** Relatório de uma página: alcance da rolagem a cada 10%, faixas de atenção, cliques e alvos mais clicados. */
export function pageJson(path: string, views: PageviewRecord[], clicks: ClickRecord[]) {
  const page = views.filter((v) => v.path === path);
  const tally = new Tally();
  const reach = new Array(11).fill(0);
  const attention = new Array(ATTENTION_BANDS).fill(0);
  let docHSum = 0, docHCount = 0;
  for (const v of page) {
    tally.add(v);
    for (let step = 0; step <= 10; step++) if (v.maxScroll >= step * 10) reach[step] += 1;
    v.attention.forEach((ms, i) => { if (i < ATTENTION_BANDS) attention[i] += ms; });
    if (v.docH > 0) { docHSum += v.docH; docHCount += 1; }
  }
  const targets = new Map<string, number>();
  for (const c of clicks) targets.set(c.label, (targets.get(c.label) ?? 0) + 1);
  return {
    path, summary: tally.toJson(path), avg_doc_h: docHCount ? Math.trunc(docHSum / docHCount) : 0,
    reach: reach.map((c) => tally.pct(c)), attention_ms: attention,
    clicks: clicks.map((c) => [c.xPct, c.yPct]),
    targets: [...targets.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 25).map(([label, n]) => ({ label, clicks: n })),
  };
}

/** Consolidação por visitante (só visitantes que consentiram). */
export function visitorRollups(views: PageviewRecord[]) {
  type Rollup = { firstSeen: Date | null; lastSeen: Date | null; firstSource: string | null; views: number; sessions: Set<string>; pages: Set<string>; activeMs: number; clicks: number; userId: string | null };
  const rollups = new Map<string, Rollup>();
  // As linhas chegam das mais novas; percorrer ao contrário faz da primeira origem a mais antiga.
  for (const v of [...views].reverse()) {
    if (!v.visitorId) continue;
    if (!rollups.has(v.visitorId)) rollups.set(v.visitorId, { firstSeen: null, lastSeen: null, firstSource: null, views: 0, sessions: new Set(), pages: new Set(), activeMs: 0, clicks: 0, userId: null });
    const r = rollups.get(v.visitorId)!;
    r.firstSeen ??= v.startedAt;
    r.lastSeen = r.lastSeen && r.lastSeen > v.lastSeenAt ? r.lastSeen : v.lastSeenAt;
    r.firstSource ??= v.utm.source ?? referrerHost(v);
    r.views += 1;
    if (v.sessionId) r.sessions.add(v.sessionId);
    r.pages.add(v.path);
    r.activeMs += v.activeMs;
    r.clicks += v.clicks;
    r.userId ??= v.userId;
  }
  return [...rollups.entries()].sort((a, b) => (b[1].lastSeen?.getTime() ?? 0) - (a[1].lastSeen?.getTime() ?? 0)).slice(0, 300);
}
