/**
 * Rastreador de marketing do site público. Port de faelith_web/apps/web/src/lib/analytics.ts.
 *
 * - Mede tempo ativo, rolagem máxima, atenção por faixa (20 faixas de 5%) e cliques de cada visualização
 * - Sem consentimento (LGPD), envia só totais anônimos: nenhum id de visitante ou sessão
 * - Nunca roda na área logada, dentro de iframes (mapa de calor) nem em navegadores automatizados
 * - Links para /checkout/<plano> são marcados `subscribe:<plano>` (intenção de assinatura no console)
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { session } from '../api/client';

export type Consent = 'granted' | 'denied' | null;

const CONSENT_KEY = 'mt.consent';
const VISITOR_KEY = 'mt.vid';
const SESSION_KEY = 'mt.sid';
const UTM_KEY = 'mt.utm';
const LP_KEY = 'mt.lp';
const CONSENT_EVENT = 'mt-consent';
const BANDS = 20;
const TICK_MS = 1000;
const FLUSH_MS = 15_000;
const IDLE_MS = 30_000;
const SESSION_IDLE_MS = 30 * 60 * 1000;
const MAX_QUEUED_CLICKS = 50;
const UTM_FIELDS = ['source', 'medium', 'campaign', 'content', 'term'] as const;
const BASE = import.meta.env.VITE_API_URL ?? '/api';

type Utm = Partial<Record<(typeof UTM_FIELDS)[number], string>>;
interface ClickPoint { x: number; y: number; l: string }

/** Lê do storage; o storage pode lançar (modo privado, dados bloqueados), o que conta como ausente. */
function readStorage(storage: () => Storage, key: string): string | null {
  try { return storage().getItem(key); } catch { return null; }
}
function writeStorage(storage: () => Storage, key: string, value: string | null): void {
  try { if (value === null) storage().removeItem(key); else storage().setItem(key, value); } catch { /* segue anônimo */ }
}
const local = () => window.localStorage;
const sess = () => window.sessionStorage;

/** Consentimento de análise deste navegador. */
export function readConsent(): Consent {
  const v = readStorage(local, CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

/** Guarda a resposta; revogar apaga os ids persistentes na hora. */
export function writeConsent(consent: 'granted' | 'denied'): void {
  writeStorage(local, CONSENT_KEY, consent);
  if (consent === 'denied') { writeStorage(local, VISITOR_KEY, null); writeStorage(sess, SESSION_KEY, null); }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Esquece a resposta e os ids para o banner perguntar de novo (link no rodapé). */
export function resetConsent(): void {
  writeStorage(local, CONSENT_KEY, null);
  writeStorage(local, VISITOR_KEY, null);
  writeStorage(sess, SESSION_KEY, null);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function onConsentChange(listener: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, listener);
  return () => window.removeEventListener(CONSENT_EVENT, listener);
}

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Id persistente do visitante e id da sessão (renova após 30 min parado); ambos null sem consentimento. */
function identity(): { vid: string | null; sid: string | null } {
  if (readConsent() !== 'granted') return { vid: null, sid: null };
  let vid = readStorage(local, VISITOR_KEY);
  if (!vid) { vid = uuid(); writeStorage(local, VISITOR_KEY, vid); }
  const now = Date.now();
  const [savedId, savedAt] = (readStorage(sess, SESSION_KEY) ?? '').split('|');
  const sid = savedId && now - Number(savedAt) < SESSION_IDLE_MS ? savedId : uuid();
  writeStorage(sess, SESSION_KEY, `${sid}|${now}`);
  return { vid, sid };
}

/** Parâmetros de campanha da URL, mantidos pelo resto da sessão da aba. */
function campaign(search: string): Utm {
  const params = new URLSearchParams(search);
  const fresh: Utm = {};
  for (const field of UTM_FIELDS) { const v = params.get(`utm_${field}`); if (v) fresh[field] = v.slice(0, 100); }
  if (Object.keys(fresh).length > 0) { writeStorage(sess, UTM_KEY, JSON.stringify(fresh)); return fresh; }
  try { return JSON.parse(readStorage(sess, UTM_KEY) ?? '{}') as Utm; } catch { return {}; }
}

/** Atribuição da sessão (UTM + variação de landing) enviada com o checkout. */
export function attribution(): { utmSource?: string; utmMedium?: string; utmCampaign?: string; lp?: string } {
  let utm: Utm = {};
  try { utm = JSON.parse(readStorage(sess, UTM_KEY) ?? '{}') as Utm; } catch { /* sem atribuição */ }
  const lp = readStorage(sess, LP_KEY);
  return { utmSource: utm.source, utmMedium: utm.medium, utmCampaign: utm.campaign, lp: lp ?? undefined };
}

function deviceClass(width: number): 'mobile' | 'tablet' | 'desktop' {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/** Páginas públicas rastreáveis (a área logada nunca é rastreada). */
const PUBLIC = ['/', '/login', '/esqueci-senha', '/termos', '/privacidade'];
function trackable(pathname: string): boolean {
  if (!PUBLIC.includes(pathname) && !pathname.startsWith('/lp/')) return false;
  if (window.self !== window.top) return false;
  return !navigator.webdriver;
}

/** `subscribe:<plano>` para links do checkout, senão null. */
function subscribeLabel(control: HTMLElement): string | null {
  const href = control.getAttribute('href');
  const m = href ? /^\/checkout\/([a-z]+)/.exec(href) : null;
  return m ? `subscribe:${m[1]}` : null;
}

/** Descrição curta e não sensível do elemento clicado (nunca valores de campos). */
function describe(target: EventTarget | null): string {
  const element = target instanceof Element ? target : null;
  if (!element) return '(página)';
  const tagged = element.closest<HTMLElement>('[data-track]');
  if (tagged?.dataset.track) return tagged.dataset.track.slice(0, 80);
  const control = element.closest<HTMLElement>('a, button, [role="button"], input, select, textarea, summary, label');
  if (control) {
    const tag = control.tagName.toLowerCase();
    const subscribe = tag === 'a' ? subscribeLabel(control) : null;
    if (subscribe) return subscribe;
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      const name = control.getAttribute('name') || control.getAttribute('type') || '';
      return `${tag}${name ? `[${name}]` : ''}`;
    }
    const text = (control.getAttribute('aria-label') || control.textContent || '').replace(/\s+/g, ' ').trim();
    const href = tag === 'a' ? control.getAttribute('href') ?? '' : '';
    return `${tag}: ${text || href}`.slice(0, 80);
  }
  const anchor = element.closest<HTMLElement>('[id], section, header, footer, nav');
  const where = anchor ? `${anchor.tagName.toLowerCase()}${anchor.id ? `#${anchor.id}` : ''}` : element.tagName.toLowerCase();
  return `(sem alvo) ${where}`.slice(0, 80);
}

/** Landings registram sua variação para as visitas serem reportadas por variação. */
let pageTag: { path: string; tag: string; canonical: string } | null = null;
export function setPageTag(path: string, tag: string, canonical: string): void {
  pageTag = { path, tag, canonical };
  writeStorage(sess, LP_KEY, tag);
}

/** Envia um beacon; com sessão e consentimento vai por fetch com o token (para ligar a visita à conta). */
function sendBeacon(body: unknown): void {
  const json = JSON.stringify(body);
  const token = session.token();
  if (token && readConsent() === 'granted') {
    void fetch(`${BASE}/t`, { method: 'POST', body: json, keepalive: true, headers: { 'content-type': 'text/plain', authorization: `Bearer ${token}` } }).catch(() => undefined);
    return;
  }
  const blob = new Blob([json], { type: 'text/plain' });
  if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(`${BASE}/t`, blob)) return;
  void fetch(`${BASE}/t`, { method: 'POST', body: json, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => undefined);
}

/** Acompanha uma visualização da montagem até `stop()` (troca de rota ou desmontagem). */
class PageView {
  private readonly id = uuid();
  private readonly utm: Utm;
  private activeMs = 0;
  private maxScroll = 0;
  private readonly attention = new Array<number>(BANDS).fill(0);
  private clicks: ClickPoint[] = [];
  private lastTick = Date.now();
  private lastInput = Date.now();
  private dirty = true;
  private readonly timers: number[] = [];
  private readonly cleanups: Array<() => void> = [];

  constructor(private readonly pathname: string, search: string) {
    this.utm = campaign(search);
    this.listen(window, 'scroll', () => this.onScroll(), { passive: true });
    for (const name of ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel']) this.listen(window, name, () => this.touch(), { passive: true });
    this.listen(document, 'click', (e) => this.onClick(e as MouseEvent), { capture: true });
    this.listen(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(); });
    this.listen(window, 'pagehide', () => this.flush());
    this.timers.push(window.setInterval(() => this.tick(), TICK_MS));
    this.timers.push(window.setInterval(() => this.flush(), FLUSH_MS));
    this.onScroll();
  }

  private listen(target: EventTarget, name: string, handler: (e: Event) => void, options?: AddEventListenerOptions) {
    target.addEventListener(name, handler, options);
    this.cleanups.push(() => target.removeEventListener(name, handler, options));
  }
  private touch() { this.lastInput = Date.now(); }
  private docHeight() { return Math.max(document.documentElement.scrollHeight, window.innerHeight, 1); }

  private onScroll() {
    this.touch();
    const reached = Math.round(((window.scrollY + window.innerHeight) / this.docHeight()) * 100);
    if (reached > this.maxScroll) { this.maxScroll = Math.min(100, reached); this.dirty = true; }
  }

  private onClick(e: MouseEvent) {
    this.touch();
    if (this.clicks.length >= MAX_QUEUED_CLICKS) return;
    const width = Math.max(document.documentElement.scrollWidth, 1);
    this.clicks.push({ x: e.pageX / width, y: e.pageY / this.docHeight(), l: describe(e.target) });
    this.dirty = true;
    // Clique que navega para outra rota: envia antes de desmontar
    if (subscribeLabel((e.target as Element)?.closest?.('a') as HTMLElement) !== null) this.flush();
  }

  /** Soma tempo ativo e atenção enquanto a aba está visível e houve interação recente. */
  private tick() {
    const now = Date.now();
    const elapsed = Math.min(now - this.lastTick, 2 * TICK_MS);
    this.lastTick = now;
    if (document.visibilityState !== 'visible' || now - this.lastInput > IDLE_MS) return;
    this.activeMs += elapsed;
    const height = this.docHeight();
    const top = window.scrollY, bottom = top + window.innerHeight;
    for (let band = 0; band < BANDS; band += 1) {
      const bandTop = (band * height) / BANDS, bandBottom = ((band + 1) * height) / BANDS;
      if (bandBottom > top && bandTop < bottom) this.attention[band] += elapsed;
    }
    this.dirty = true;
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const tag = pageTag && pageTag.path === this.pathname ? pageTag : null;
    const { vid, sid } = identity();
    sendBeacon({
      pv: this.id, vid, sid, consent: readConsent() === 'granted', path: tag?.canonical ?? this.pathname, ref: document.referrer || null,
      utm: this.utm, lp: tag?.tag ?? null, device: deviceClass(window.innerWidth), lang: navigator.language,
      vw: window.innerWidth, vh: window.innerHeight, dh: this.docHeight(), active_ms: this.activeMs, max_scroll: this.maxScroll,
      attention: this.attention, clicks: this.clicks,
    });
    this.clicks = [];
  }

  stop() {
    this.tick();
    this.flush();
    this.timers.forEach((t) => window.clearInterval(t));
    this.cleanups.forEach((c) => c());
  }
}

/** Inicia uma visualização a cada rota pública; montado uma vez na raiz do app. */
/** A prévia do mapa de calor carrega a página num iframe do console: não conta como visita. */
export function inPreview(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

export function usePageTracking(): void {
  const location = useLocation();
  useEffect(() => {
    campaign(location.search); // guarda UTM mesmo em páginas não rastreadas (atribuição do checkout)
    if (inPreview() || !trackable(location.pathname)) return undefined;
    const view = new PageView(location.pathname, location.search);
    return () => view.stop();
  }, [location.pathname, location.search]);
}
