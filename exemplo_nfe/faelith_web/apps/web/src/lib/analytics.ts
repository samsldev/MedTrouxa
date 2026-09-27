/**
 * @fileoverview First-party marketing tracker: consent state, page views, scroll, attention, and click beacons.
 * @author Samuel S. L.
 * @version 1.1.0
 * @since 2026-09-26
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 * All information contained herein is, and remains, the property of
 * Samuel S. L. and its suppliers, if any.
 *
 * The intellectual, technical, creative, and software concepts contained
 * herein are proprietary to Samuel S. L. and its suppliers and
 * are protected by copyright law, trade secret law, and other applicable
 * intellectual property laws in the Netherlands, the European Union, and
 * other foreign jurisdictions.
 *
 * Where applicable, such rights may be registered, recorded, or protected
 * with the competent authorities of the Government of the Netherlands,
 * the European Union, and/or other relevant jurisdictions.
 *
 * Dissemination of this information, reproduction of this material,
 * modification, distribution, disclosure, or commercial use is strictly
 * forbidden unless prior written permission is obtained from
 * Samuel S. L.
 *
 * @commercialUse Commercial use permitted only with prior written permission from Samuel S. L.
 *
 * <DETAILED_DESCRIPTION>:
 * - Public pages only (never /app, /cli, framed pages, or automation); beacons go to POST /api/t
 * - Without consent nothing persistent is written or sent: no visitor id, no session id
 * - With consent a random visitor id (localStorage) and a 30-minute session id (sessionStorage) link views
 * - Attention = visible, recently active milliseconds per 5 percent band of the page height
 * - Subscribe CTAs are labelled `subscribe:<plan>:<interval>[:intro]` (data-track or /subscribe links)
 * - Beacons flush every 15 s and on hide/route change via sendBeacon (fetch keepalive fallback)
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Analytics consent as stored in the browser; null until the visitor answers the banner. */
export type Consent = 'granted' | 'denied' | null;

const CONSENT_KEY = 'fae.consent';
const VISITOR_KEY = 'fae.vid';
const SESSION_KEY = 'fae.sid';
const UTM_KEY = 'fae.utm';
const CONSENT_EVENT = 'fae-consent';
const BANDS = 20;
const TICK_MS = 1000;
const FLUSH_MS = 15_000;
const IDLE_MS = 30_000;
const SESSION_IDLE_MS = 30 * 60 * 1000;
const MAX_QUEUED_CLICKS = 50;
const UTM_FIELDS = ['source', 'medium', 'campaign', 'content', 'term'] as const;

type Utm = Partial<Record<(typeof UTM_FIELDS)[number], string>>;

interface ClickPoint {
  x: number;
  y: number;
  l: string;
}

/**
 * Reads a storage value; storage can throw (privacy mode, blocked site data), which reads as absent.
 */
function readStorage(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

/**
 * Writes or removes a storage value, ignoring storage failures.
 */
function writeStorage(storage: () => Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Storage unavailable: the tracker keeps working anonymously.
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

/**
 * Current analytics consent of this browser.
 */
export function readConsent(): Consent {
  const value = readStorage(local, CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

/**
 * Stores the visitor's answer; revoking consent deletes the persistent ids immediately.
 */
export function writeConsent(consent: 'granted' | 'denied'): void {
  writeStorage(local, CONSENT_KEY, consent);
  if (consent === 'denied') {
    writeStorage(local, VISITOR_KEY, null);
    writeStorage(session, SESSION_KEY, null);
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/**
 * Forgets the stored answer and the persistent ids, so the banner asks again (footer link).
 */
export function resetConsent(): void {
  writeStorage(local, CONSENT_KEY, null);
  writeStorage(local, VISITOR_KEY, null);
  writeStorage(session, SESSION_KEY, null);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/**
 * Subscribes to consent changes made in this tab; returns the unsubscribe function.
 */
export function onConsentChange(listener: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, listener);
  return () => window.removeEventListener(CONSENT_EVENT, listener);
}

/**
 * Random v4 UUID (crypto.randomUUID where available).
 */
function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Persistent visitor id and rolling session id; both null without consent.
 */
function identity(): { vid: string | null; sid: string | null } {
  if (readConsent() !== 'granted') return { vid: null, sid: null };
  let vid = readStorage(local, VISITOR_KEY);
  if (!vid) {
    vid = uuid();
    writeStorage(local, VISITOR_KEY, vid);
  }
  const now = Date.now();
  const [savedId, savedAt] = (readStorage(session, SESSION_KEY) ?? '').split('|');
  const sid = savedId && now - Number(savedAt) < SESSION_IDLE_MS ? savedId : uuid();
  writeStorage(session, SESSION_KEY, `${sid}|${now}`);
  return { vid, sid };
}

/**
 * Campaign parameters of the current URL, carried for the rest of the tab session.
 */
function campaign(search: string): Utm {
  const params = new URLSearchParams(search);
  const fresh: Utm = {};
  for (const field of UTM_FIELDS) {
    const value = params.get(`utm_${field}`);
    if (value) fresh[field] = value.slice(0, 100);
  }
  if (Object.keys(fresh).length > 0) {
    writeStorage(session, UTM_KEY, JSON.stringify(fresh));
    return fresh;
  }
  try {
    return JSON.parse(readStorage(session, UTM_KEY) ?? '{}') as Utm;
  } catch {
    return {};
  }
}

/**
 * Device class from the viewport width (matches the admin heatmap frames).
 */
function deviceClass(width: number): 'mobile' | 'tablet' | 'desktop' {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/**
 * True when this page may be tracked: public route, top-level window, real browser.
 */
function trackable(pathname: string): boolean {
  if (/^\/(app|cli|api|auth)(\/|$)/.test(pathname)) return false;
  if (window.self !== window.top) return false;
  return !navigator.webdriver;
}

/**
 * `subscribe:<plan>:<interval>[:intro]` for links to the checkout shortcut, else null.
 */
function subscribeLabel(control: HTMLElement): string | null {
  const href = control.getAttribute('href');
  if (!href || !href.startsWith('/subscribe')) return null;
  const params = new URLSearchParams(href.split('?')[1] ?? '');
  const offer = params.get('offer') === 'intro' ? ':intro' : '';
  return `subscribe:${params.get('plan') || 'starter'}:${params.get('interval') || 'monthly'}${offer}`;
}

/**
 * Short, non-sensitive description of a clicked element (never input values).
 */
function describe(target: EventTarget | null): string {
  const element = target instanceof Element ? target : null;
  if (!element) return '(page)';
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
  return `(no target) ${where}`.slice(0, 80);
}

/** Landing pages register their resolved variant so random `/lp` visits are reported per variant. */
let pageTag: { path: string; tag: string; canonical: string } | null = null;

/**
 * Called by a landing page with its resolved variant (`code-2-br`) and pinned URL.
 */
export function setPageTag(path: string, tag: string, canonical: string): void {
  pageTag = { path, tag, canonical };
}

/**
 * Sends one JSON beacon; sendBeacon survives page unload, fetch keepalive is the fallback.
 */
function sendBeacon(body: unknown): void {
  const json = JSON.stringify(body);
  const blob = new Blob([json], { type: 'text/plain' });
  if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/api/t', blob)) return;
  void fetch('/api/t', { method: 'POST', body: json, keepalive: true, credentials: 'include' }).catch(() => undefined);
}

/**
 * Tracks one page view from mount until `stop()` (route change or unmount).
 */
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

  private readonly pathname: string;

  constructor(pathname: string, search: string) {
    this.pathname = pathname;
    this.utm = campaign(search);
    this.listen(window, 'scroll', () => this.onScroll(), { passive: true });
    for (const name of ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel']) {
      this.listen(window, name, () => this.touch(), { passive: true });
    }
    this.listen(document, 'click', (event) => this.onClick(event as MouseEvent), { capture: true });
    this.listen(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
    this.listen(window, 'pagehide', () => this.flush());
    this.timers.push(window.setInterval(() => this.tick(), TICK_MS));
    this.timers.push(window.setInterval(() => this.flush(), FLUSH_MS));
    this.onScroll();
  }

  /** Adds a listener that `stop()` removes. */
  private listen(target: EventTarget, name: string, handler: (event: Event) => void, options?: AddEventListenerOptions): void {
    target.addEventListener(name, handler, options);
    this.cleanups.push(() => target.removeEventListener(name, handler, options));
  }

  /** Records user activity (keeps the view "active"). */
  private touch(): void {
    this.lastInput = Date.now();
  }

  /** Current document height in CSS pixels. */
  private docHeight(): number {
    return Math.max(document.documentElement.scrollHeight, window.innerHeight, 1);
  }

  /** Updates the deepest scroll position reached, as a percentage of the page. */
  private onScroll(): void {
    this.touch();
    const reached = Math.round(((window.scrollY + window.innerHeight) / this.docHeight()) * 100);
    if (reached > this.maxScroll) {
      this.maxScroll = Math.min(100, reached);
      this.dirty = true;
    }
  }

  /** Queues a click point in page-relative coordinates. */
  private onClick(event: MouseEvent): void {
    this.touch();
    if (this.clicks.length >= MAX_QUEUED_CLICKS) return;
    const width = Math.max(document.documentElement.scrollWidth, 1);
    this.clicks.push({ x: event.pageX / width, y: event.pageY / this.docHeight(), l: describe(event.target) });
    this.dirty = true;
  }

  /** Accrues active time and attention while the tab is visible and the visitor recently interacted. */
  private tick(): void {
    const now = Date.now();
    const elapsed = Math.min(now - this.lastTick, 2 * TICK_MS);
    this.lastTick = now;
    if (document.visibilityState !== 'visible' || now - this.lastInput > IDLE_MS) return;
    this.activeMs += elapsed;
    const height = this.docHeight();
    const top = window.scrollY;
    const bottom = top + window.innerHeight;
    for (let band = 0; band < BANDS; band += 1) {
      const bandTop = (band * height) / BANDS;
      const bandBottom = ((band + 1) * height) / BANDS;
      if (bandBottom > top && bandTop < bottom) this.attention[band] += elapsed;
    }
    this.dirty = true;
  }

  /** Sends the cumulative state and the clicks queued since the last beacon. */
  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const tag = pageTag && pageTag.path === this.pathname ? pageTag : null;
    const { vid, sid } = identity();
    sendBeacon({
      pv: this.id,
      vid,
      sid,
      consent: readConsent() === 'granted',
      path: tag?.canonical ?? this.pathname,
      ref: document.referrer || null,
      utm: this.utm,
      lp: tag?.tag ?? null,
      device: deviceClass(window.innerWidth),
      lang: navigator.language,
      vw: window.innerWidth,
      vh: window.innerHeight,
      dh: this.docHeight(),
      active_ms: this.activeMs,
      max_scroll: this.maxScroll,
      attention: this.attention,
      clicks: this.clicks,
    });
    this.clicks = [];
  }

  /** Final beacon and teardown. */
  stop(): void {
    this.tick();
    this.flush();
    this.timers.forEach((timer) => window.clearInterval(timer));
    this.cleanups.forEach((cleanup) => cleanup());
  }
}

/**
 * Starts a page view on every public route change; mounted once at the app root.
 */
export function usePageTracking(): void {
  const location = useLocation();
  useEffect(() => {
    if (!trackable(location.pathname)) return undefined;
    const view = new PageView(location.pathname, location.search);
    return () => view.stop();
  }, [location.pathname, location.search]);
}
