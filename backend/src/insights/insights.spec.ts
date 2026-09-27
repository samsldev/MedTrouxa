import { randomUUID } from 'crypto';
import { ATTENTION_BANDS, PageviewRecord } from './analytics-store';
import { beaconRows, cleanPath, cleanReferrer, isBot, matches, MAX_ACTIVE_MS, overviewJson, pageJson, resolveRange } from './analytics';
import { liveAt, monthlyCents, mrrSeries, profitLine, refundJson, resolveTax, SubRow, subscriptionsJson } from './business';

const DAY = 86_400_000;

describe('analytics (port de analytics.rs)', () => {
  it('só páginas públicas; query strings removidas', () => {
    expect(cleanPath('/?utm_source=x')).toBe('/');
    expect(cleanPath('/lp/enamed/a?x=1')).toBe('/lp/enamed/a');
    expect(cleanPath('/inicio')).toBeNull();
    expect(cleanPath('/api/t')).toBeNull();
    expect(cleanPath('https://evil.example/')).toBeNull();
    expect(cleanPath('//evil.example/')).toBeNull();
  });

  it('referrer mantém só host e caminho', () => {
    expect(cleanReferrer('https://www.google.com/search?q=segredo')).toBe('https://www.google.com/search');
    expect(cleanReferrer('não é url')).toBeNull();
  });

  it('bots e user-agent ausente são descartados', () => {
    expect(isBot('Googlebot/2.1')).toBe(true);
    expect(isBot('HeadlessChrome')).toBe(true);
    expect(isBot(undefined)).toBe(true);
    expect(isBot('Mozilla/5.0 (iPhone)')).toBe(false);
  });

  it('sem consentimento os ids persistentes são descartados; valores são limitados', () => {
    const { view, clicks } = beaconRows({
      pv: randomUUID(), vid: randomUUID(), sid: randomUUID(), consent: false, path: '/', active_ms: 99_999_999_999, max_scroll: 250,
      attention: [1, 2], clicks: [{ x: 2, y: -1, l: 'cta' }],
    }, '/', null, new Date());
    expect(view.visitorId).toBeNull();
    expect(view.sessionId).toBeNull();
    expect(view.activeMs).toBe(MAX_ACTIVE_MS);
    expect(view.maxScroll).toBe(100);
    expect(view.attention).toHaveLength(ATTENTION_BANDS);
    expect([clicks[0].xPct, clicks[0].yPct]).toEqual([1, 0]);
  });

  const view = (p: Partial<PageviewRecord>): PageviewRecord => ({
    id: randomUUID(), visitorId: null, sessionId: null, userId: null, path: '/', referrer: null,
    utm: { source: null, medium: null, campaign: null, content: null, term: null }, lp: 'enamed-a', device: 'desktop', lang: null,
    viewportW: 0, viewportH: 0, docH: 1000, startedAt: new Date(), lastSeenAt: new Date(), activeMs: 0, maxScroll: 0,
    attention: new Array(ATTENTION_BANDS).fill(0), clicks: 0, ...p,
  });

  it('filtros de segmento: valores exatos; vazios e dispositivos desconhecidos são ignorados', () => {
    const meta = (source: string | null, device: string) => view({ utm: { source, medium: null, campaign: null, content: null, term: null }, device });
    const q = { source: 'meta', device: 'mobile', lp: ' ' };
    expect(matches(q, meta('meta', 'mobile'))).toBe(true);
    expect(matches(q, meta('google', 'mobile'))).toBe(false);
    expect(matches(q, meta(null, 'mobile'))).toBe(false);
    expect(matches(q, meta('meta', 'desktop'))).toBe(false);
    expect(matches({ device: 'geladeira' }, meta(null, 'desktop'))).toBe(true);
  });

  it('período padrão de 7 dias; rejeita invertido ou longo demais; aceita 24h exatas', () => {
    const { from, to } = resolveRange({});
    expect(to.getTime() - from.getTime()).toBe(7 * DAY);
    expect(() => resolveRange({ from: '2026-09-10', to: '2026-09-01' })).toThrow();
    expect(() => resolveRange({ from: '2024-01-01', to: '2026-01-01' })).toThrow();
    const day = resolveRange({ from: '2026-09-25T12:00:00Z', to: '2026-09-26T12:00:00Z' });
    expect(day.to.getTime() - day.from.getTime()).toBe(DAY);
  });

  it('visão geral e mapa de calor agregam rejeição, alcance e atenção', () => {
    const vid = randomUUID();
    const views = [
      view({ visitorId: vid, activeMs: 30_000, maxScroll: 80, clicks: 1, attention: [5, ...new Array(19).fill(1)] }),
      view({ activeMs: 2_000, maxScroll: 10 }),
    ];
    const o = overviewJson(views, new Date(Date.now() - DAY), new Date(Date.now() + DAY));
    expect(o.totals.views).toBe(2);
    expect(o.totals.visitors).toBe(1);
    expect(o.totals.bounce_rate).toBe(50);
    expect(o.anonymous_views).toBe(1);
    const p = pageJson('/', views, [{ pageviewId: views[0].id, path: '/', device: 'desktop', xPct: 0.5, yPct: 0.1, label: 'a: Começar', at: new Date() }]);
    expect(p.reach[0]).toBe(100);
    expect(p.reach[8]).toBe(50);
    expect(p.attention_ms[0]).toBe(5);
    expect(p.targets[0]).toEqual({ label: 'a: Começar', clicks: 1 });
  });
});

describe('negócio (port de admin_billing.rs + MRR/ARR do MedTrouxa)', () => {
  const now = new Date('2026-09-27T12:00:00Z');
  const sub = (p: Partial<SubRow>): SubRow => {
    const paidAt = p.paidAt === undefined ? new Date(now.getTime() - 3 * DAY) : p.paidAt;
    const years = p.planId === 'arcano' ? 6 : 1;
    const expiresAt = paidAt ? new Date(paidAt.getTime() + years * 365 * DAY) : null;
    return {
      id: randomUUID(), userId: randomUUID(), planId: 'alquimista', paymentMethod: 'card', installments: 12, amount: 95_880, status: paidAt ? 'active' : 'pending',
      createdAt: paidAt ?? now, paidAt, startsAt: paidAt, expiresAt, canceledAt: null, grantedBy: null, utmSource: null, utmCampaign: null, lp: null, ...p,
    };
  };

  it('MRR distribui o valor pago pelos meses de acesso; ARR = MRR × 12; cortesia fica fora', () => {
    const subs = [
      sub({ amount: 95_880 }),                                  // Alquimista 12x: 958,80 / 12 = 79,90
      sub({ planId: 'arcano', amount: 189_990, paymentMethod: 'pix', installments: 1 }), // 1.899,90 / 72 = 26,39
      sub({ grantedBy: 'admin@x', amount: 0 }),
      sub({ paidAt: null }),                                    // checkout em aberto
    ];
    expect(monthlyCents(subs[0])).toBe(7_990);
    expect(monthlyCents(subs[1])).toBe(2_639);
    const r = subscriptionsJson(subs, new Map(), new Map(), now, new Date(now.getTime() - 7 * DAY), new Date(now.getTime() + DAY), resolveTax({ revenue_tax: '6', profit_tax: '0', payment_fee: '0' }));
    expect(r.mrr_cents).toBe(10_629);
    expect(r.arr_cents).toBe(10_629 * 12);
    expect([r.live, r.paying, r.granted]).toEqual([3, 2, 1]);
    expect(r.checkout.totals).toMatchObject({ started: 3, completed: 2, open: 1, conversion: 66.7 });
  });

  it('assinatura estornada deixa de contar no MRR a partir do cancelamento', () => {
    const s = sub({ status: 'canceled', canceledAt: new Date(now.getTime() - DAY) });
    expect(liveAt(s, new Date(now.getTime() - 2 * DAY))).toBe(true);
    expect(liveAt(s, now)).toBe(false);
    const series = mrrSeries([s], new Date(now.getTime() - 4 * DAY), now);
    expect(series.map((d) => d.mrr_cents)).toEqual([0, 7_990, 7_990, 0, 0]); // 5 dias de calendário (o período começa ao meio-dia)
  });

  it('lucro: receita - custo - taxas - imposto sobre receita - imposto sobre o lucro restante', () => {
    const line = profitLine(100_000, 20_000, 5_000, { revenue: 0.06, profit: 0.34, feePix: 0, feeCard: 0 });
    expect(line).toMatchObject({ revenue_tax_cents: 6_000, profit_tax_cents: 23_460, profit_cents: 45_540, margin: 45.5 });
  });

  it('janela de arrependimento de 7 dias: abertas, fechando em 48h e taxa de reembolso', () => {
    const subs = [
      sub({ paidAt: new Date(now.getTime() - 6 * DAY) }), // fecha em 24h
      sub({ paidAt: new Date(now.getTime() - 1 * DAY) }),
      sub({ paidAt: new Date(now.getTime() - 2 * DAY), status: 'canceled', canceledAt: new Date(now.getTime() - DAY) }),
      sub({ paidAt: new Date(now.getTime() - 20 * DAY) }), // já fechou
    ];
    const r = refundJson(subs, now, new Date(now.getTime() - 7 * DAY), new Date(now.getTime() + DAY));
    expect([r.open, r.closing_soon, r.opened_in_range, r.refunded_in_range]).toEqual([2, 1, 3, 1]);
    expect(r.refund_rate).toBe(33.3);
  });
});
