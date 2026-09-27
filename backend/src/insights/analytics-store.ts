/**
 * Armazenamento do rastreador de marketing. Port de faelith-web/src/analytics_store.rs.
 *
 * - As visualizações são gravadas por beacons repetidos e mescladas de forma monotônica (tempo, rolagem e atenção só crescem)
 * - Identidade (visitante, sessão) é gravada pelo primeiro beacon e nunca sobrescrita
 * - As leituras devolvem linhas cruas; a agregação fica em `analytics.ts`
 */
import { DataSource } from 'typeorm';

/** Faixas verticais (5% da altura da página cada) do mapa de atenção. */
export const ATTENTION_BANDS = 20;

export interface Utm { source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null }

/** Uma visualização de página; `clicks` é o total acumulado de cliques. */
export interface PageviewRecord {
  id: string;
  /** Id persistente do visitante; null sem consentimento. */
  visitorId: string | null;
  /** Id da sessão do navegador; null sem consentimento. */
  sessionId: string | null;
  /** Usuário logado (só com consentimento). */
  userId: string | null;
  path: string;
  referrer: string | null;
  utm: Utm;
  lp: string | null;
  device: string;
  lang: string | null;
  viewportW: number;
  viewportH: number;
  docH: number;
  startedAt: Date;
  lastSeenAt: Date;
  activeMs: number;
  maxScroll: number;
  /** Milissegundos visíveis acumulados por faixa; sempre `ATTENTION_BANDS` itens. */
  attention: number[];
  clicks: number;
}

/** Um clique em coordenadas relativas à página (0..1 da largura e da altura do documento). */
export interface ClickRecord {
  pageviewId: string;
  path: string;
  device: string;
  xPct: number;
  yPct: number;
  /** Descrição curta do elemento clicado (tag, texto ou href). */
  label: string;
  at: Date;
}

type Row = Record<string, unknown>;
const mapView = (r: Row): PageviewRecord => ({
  id: r.id as string, visitorId: (r.visitor_id as string) ?? null, sessionId: (r.session_id as string) ?? null, userId: (r.user_id as string) ?? null,
  path: r.path as string, referrer: (r.referrer as string) ?? null,
  utm: { source: (r.utm_source as string) ?? null, medium: (r.utm_medium as string) ?? null, campaign: (r.utm_campaign as string) ?? null, content: (r.utm_content as string) ?? null, term: (r.utm_term as string) ?? null },
  lp: (r.lp as string) ?? null, device: r.device as string, lang: (r.lang as string) ?? null,
  viewportW: Number(r.viewport_w), viewportH: Number(r.viewport_h), docH: Number(r.doc_h),
  startedAt: new Date(r.started_at as string), lastSeenAt: new Date(r.last_seen_at as string),
  activeMs: Number(r.active_ms), maxScroll: Number(r.max_scroll),
  attention: ((r.attention as (string | number)[]) ?? []).map(Number), clicks: Number(r.clicks),
});
const mapClick = (r: Row): ClickRecord => ({
  pageviewId: r.pageview_id as string, path: r.path as string, device: r.device as string, xPct: Number(r.x_pct), yPct: Number(r.y_pct),
  label: r.label as string, at: new Date(r.at as string),
});
const VIEW_COLS = `id, visitor_id, session_id, user_id, path, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, lp, device, lang,
  viewport_w, viewport_h, doc_h, started_at, last_seen_at, active_ms, max_scroll, attention, clicks`;

/** Armazenamento Postgres do rastreador. */
export class AnalyticsStore {
  constructor(private db: DataSource) {}

  /** Insere a visualização ou mescla um beacon mais novo nela (identidade fica, métricas só crescem). */
  async upsertPageview(v: PageviewRecord) {
    await this.db.query(
      `INSERT INTO analytics_pageviews (${VIEW_COLS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       ON CONFLICT (id) DO UPDATE SET
         user_id = COALESCE(analytics_pageviews.user_id, EXCLUDED.user_id),
         last_seen_at = GREATEST(analytics_pageviews.last_seen_at, EXCLUDED.last_seen_at),
         doc_h = GREATEST(analytics_pageviews.doc_h, EXCLUDED.doc_h),
         max_scroll = GREATEST(analytics_pageviews.max_scroll, EXCLUDED.max_scroll),
         attention = CASE WHEN EXCLUDED.active_ms >= analytics_pageviews.active_ms THEN EXCLUDED.attention ELSE analytics_pageviews.attention END,
         active_ms = GREATEST(analytics_pageviews.active_ms, EXCLUDED.active_ms),
         clicks = analytics_pageviews.clicks + EXCLUDED.clicks`,
      [v.id, v.visitorId, v.sessionId, v.userId, v.path, v.referrer, v.utm.source, v.utm.medium, v.utm.campaign, v.utm.content, v.utm.term,
        v.lp, v.device, v.lang, v.viewportW, v.viewportH, v.docH, v.startedAt, v.lastSeenAt, v.activeMs, v.maxScroll, v.attention, v.clicks]);
  }

  async insertClicks(clicks: ClickRecord[]) {
    if (!clicks.length) return;
    const values: unknown[] = [];
    const rows = clicks.map((c, i) => {
      values.push(c.pageviewId, c.path, c.device, c.xPct, c.yPct, c.label, c.at);
      const b = i * 7;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`;
    });
    await this.db.query(`INSERT INTO analytics_clicks (pageview_id, path, device, x_pct, y_pct, label, at) VALUES ${rows.join(',')}`, values);
  }

  /** Visualizações iniciadas em `[from, to)`, mais recentes primeiro, no máximo `limit`. */
  async pageviewsBetween(from: Date, to: Date, limit: number) {
    const rows: Row[] = await this.db.query(`SELECT ${VIEW_COLS} FROM analytics_pageviews WHERE started_at >= $1 AND started_at < $2 ORDER BY started_at DESC LIMIT $3`, [from, to, limit]);
    return rows.map(mapView);
  }

  /** Cliques de um caminho em `[from, to)`, opcionalmente de um tipo de dispositivo. */
  async clicksForPath(path: string, from: Date, to: Date, device: string | null, limit: number) {
    const rows: Row[] = await this.db.query(
      `SELECT pageview_id, path, device, x_pct, y_pct, label, at FROM analytics_clicks
       WHERE path = $1 AND at >= $2 AND at < $3 AND ($4::text IS NULL OR device = $4) ORDER BY at DESC LIMIT $5`, [path, from, to, device, limit]);
    return rows.map(mapClick);
  }

  /** Todas as visualizações de um visitante que consentiu, mais recentes primeiro. */
  async pageviewsForVisitor(visitorId: string, limit: number) {
    const rows: Row[] = await this.db.query(`SELECT ${VIEW_COLS} FROM analytics_pageviews WHERE visitor_id = $1 ORDER BY started_at DESC LIMIT $2`, [visitorId, limit]);
    return rows.map(mapView);
  }

  /** Cliques das visualizações informadas, mais antigos primeiro. */
  async clicksForPageviews(ids: string[]) {
    if (!ids.length) return [];
    const rows: Row[] = await this.db.query(`SELECT pageview_id, path, device, x_pct, y_pct, label, at FROM analytics_clicks WHERE pageview_id = ANY($1::uuid[]) ORDER BY at`, [ids]);
    return rows.map(mapClick);
  }

  /** Cliques em `[from, to)` cujo rótulo começa com `prefix` (CTAs rastreados). */
  async clicksWithPrefix(prefix: string, from: Date, to: Date, limit: number) {
    const rows: Row[] = await this.db.query(
      `SELECT pageview_id, path, device, x_pct, y_pct, label, at FROM analytics_clicks
       WHERE label LIKE $1 AND at >= $2 AND at < $3 ORDER BY at DESC LIMIT $4`, [`${prefix.replace(/[%_\\]/g, '\\$&')}%`, from, to, limit]);
    return rows.map(mapClick);
  }
}
