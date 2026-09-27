/**
 * Relatórios de negócio do console. Port de faelith-web/src/admin_billing.rs adaptado ao MedTrouxa, mais a visão geral.
 *
 * - Assinaturas anuais pagas no Mercado Pago (à vista ou parcelado) e o Arcano de 6 anos: o MRR distribui o valor
 *   efetivamente pago pelos meses de acesso (valor / (anos × 12)); ARR = MRR × 12. Cortesias (concedidas pelo admin)
 *   não entram no MRR
 * - Lucro real = receita - custos (infraestrutura e IA) - taxas de pagamento (Pix / cartão) - imposto sobre a receita -
 *   imposto sobre o lucro restante; alíquotas configuráveis (ADMIN_TAX_*), sobrescrevíveis por requisição
 * - Janela de arrependimento (CDC art. 49): 7 dias após o pagamento; abertas agora, fechando em 48h, abertas e
 *   reembolsadas no período, taxa de reembolso
 * - Funil de checkout (iniciados, pagos, em aberto, recusados) por plano, forma de pagamento, parcelamento, landing e fonte
 * - Compradores das assinaturas ativas: pessoa física (CPF) x empresa (CNPJ) com MRR, faculdade e forma de pagamento
 */
import { planById, PLANS } from '../billing/plans';

export interface SubRow {
  id: string; userId: string; planId: string; paymentMethod: string; installments: number; amount: number; status: string;
  createdAt: Date; paidAt: Date | null; startsAt: Date | null; expiresAt: Date | null; canceledAt: Date | null;
  grantedBy: string | null; utmSource: string | null; utmCampaign: string | null; lp: string | null;
}

const DAY = 86_400_000;
const MONTH_DAYS = 30;
/** Prazo de arrependimento do CDC para compras online. */
export const REFUND_WINDOW_DAYS = 7;
const CLOSING_SOON_H = 48;

export const planName = (id: string) => planById(id)?.name ?? id;
const years = (planId: string) => planById(planId)?.accessYears ?? 1;

/** Assinatura com relacionamento vigente em `at`. */
export const liveAt = (s: SubRow, at: Date) =>
  !!s.startsAt && !!s.expiresAt && s.startsAt <= at && s.expiresAt > at && (s.status === 'active' || (s.canceledAt !== null && s.canceledAt > at));
/** Pagante (não é cortesia) com relacionamento vigente em `at`. */
export const payingAt = (s: SubRow, at: Date) => liveAt(s, at) && !s.grantedBy && s.amount > 0;

/** Receita recorrente mensal de uma assinatura em centavos (valor pago distribuído pelos meses de acesso). */
export const monthlyCents = (s: SubRow) => Math.round(s.amount / (years(s.planId) * 12));

export const rate = (part: number, base: number) => (base === 0 ? 0 : Math.round((part * 1000) / base) / 10);

const inRange = (d: Date | null, from: Date, to: Date) => !!d && d >= from && d < to;
const methodLabel = (s: SubRow) => (s.paymentMethod === 'pix' ? 'Pix' : 'Cartão');
const installmentsLabel = (s: SubRow) => (s.installments <= 1 ? 'à vista' : s.installments <= 6 ? '2x a 6x' : '7x a 12x');

/** Linhas `{ name, count }` ordenadas. */
export function countRows(map: Map<string, number>) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
}
const bump = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

/** Funil de checkout de um grupo. */
class Funnel {
  started = 0; completed = 0; open = 0; failed = 0; revenue = 0;
  add(s: SubRow) {
    this.started += 1;
    if (s.paidAt) { this.completed += 1; this.revenue += s.amount; }
    else if (s.status === 'pending') this.open += 1;
    else this.failed += 1;
  }
  toJson(name: string) {
    return { name, started: this.started, completed: this.completed, open: this.open, failed: this.failed, conversion: rate(this.completed, this.started), revenue_cents: this.revenue };
  }
}
function funnelRows(subs: SubRow[], key: (s: SubRow) => string | null) {
  const groups = new Map<string, Funnel>();
  for (const s of subs) {
    const k = key(s);
    if (k === null) continue;
    if (!groups.has(k)) groups.set(k, new Funnel());
    groups.get(k)!.add(s);
  }
  return [...groups.entries()].sort((a, b) => b[1].started - a[1].started || a[0].localeCompare(b[0])).map(([n, f]) => f.toJson(n));
}

/** Alíquotas como frações (0.06 = 6%). */
export interface TaxRates { revenue: number; profit: number; feePix: number; feeCard: number }
export interface TaxQuery { revenue_tax?: string; profit_tax?: string; payment_fee?: string; monthly_cost?: string }

const envPct = (name: string, def: number) => { const v = Number(process.env[name]); return Number.isFinite(v) && process.env[name] ? v : def; };

/** Alíquotas: sobrescritas da requisição (0..100) sobre os padrões configurados. */
export function resolveTax(q: TaxQuery): { rates: TaxRates; monthlyCostCents: number; feeSource: 'override' | 'config' } {
  const pct = (v: string | undefined, def: number) => { const n = Number(v); return (Number.isFinite(n) && v !== undefined && v !== '' ? Math.min(100, Math.max(0, n)) : def) / 100; };
  const fee = q.payment_fee !== undefined && q.payment_fee !== '' ? pct(q.payment_fee, 0) : null;
  const cost = Number(q.monthly_cost);
  return {
    rates: {
      revenue: pct(q.revenue_tax, envPct('ADMIN_TAX_REVENUE_PCT', 6)),
      profit: pct(q.profit_tax, envPct('ADMIN_TAX_PROFIT_PCT', 0)),
      feePix: fee ?? envPct('ADMIN_FEE_PIX_PCT', 0.99) / 100,
      feeCard: fee ?? envPct('ADMIN_FEE_CARD_PCT', 4.98) / 100,
    },
    monthlyCostCents: Number.isFinite(cost) && q.monthly_cost ? Math.max(0, Math.round(cost * 100)) : Math.round(envPct('ADMIN_MONTHLY_COST_BRL', 0) * 100),
    feeSource: fee !== null ? 'override' : 'config',
  };
}

/** Linha de lucro: receita - custo - taxas - imposto sobre a receita - imposto sobre o restante positivo. */
export function profitLine(revenue: number, cost: number, fee: number, r: TaxRates) {
  const revenueTax = Math.round(revenue * r.revenue);
  const beforeProfitTax = revenue - cost - fee - revenueTax;
  const profitTax = Math.round(Math.max(0, beforeProfitTax) * r.profit);
  const profit = beforeProfitTax - profitTax;
  return {
    revenue_cents: revenue, cost_cents: cost, fee_cents: fee, revenue_tax_cents: revenueTax, profit_tax_cents: profitTax,
    tax_cents: revenueTax + profitTax, profit_cents: profit, margin: revenue > 0 ? Math.round((profit * 1000) / revenue) / 10 : 0,
  };
}
const feeOf = (s: SubRow, cents: number, r: TaxRates) => Math.round(cents * (s.paymentMethod === 'pix' ? r.feePix : r.feeCard));

/** Seção de lucro real: base mensal por plano / forma de pagamento (MRR) e o caixa do período. */
export function profitJson(subs: SubRow[], now: Date, from: Date, to: Date, tax: ReturnType<typeof resolveTax>) {
  const r = tax.rates;
  const paying = subs.filter((s) => payingAt(s, now));
  const totalMrr = paying.reduce((a, s) => a + monthlyCents(s), 0);
  const groups = new Map<string, { count: number; mrr: number; fee: number }>();
  for (const s of paying) {
    const k = `${planName(s.planId)} / ${methodLabel(s)}`;
    const g = groups.get(k) ?? { count: 0, mrr: 0, fee: 0 };
    const m = monthlyCents(s);
    g.count += 1; g.mrr += m; g.fee += feeOf(s, m, r);
    groups.set(k, g);
  }
  // Custo mensal (infraestrutura, IA, e-mail...) rateado pela participação no MRR
  const share = (mrr: number) => (totalMrr > 0 ? Math.round((tax.monthlyCostCents * mrr) / totalMrr) : 0);
  let tCount = 0, tFee = 0;
  const rows = [...groups.entries()].sort().map(([name, g]) => {
    tCount += g.count; tFee += g.fee;
    const line = profitLine(g.mrr, share(g.mrr), g.fee, r);
    return { ...line, name, subscriptions: g.count, profit_per_sub_cents: g.count ? Math.trunc(line.profit_cents / g.count) : 0 };
  });
  const total = { ...profitLine(totalMrr, tax.monthlyCostCents, tFee, r), subscriptions: tCount };
  const periodDays = (to.getTime() - from.getTime()) / DAY;
  const paid = subs.filter((s) => !s.grantedBy && inRange(s.paidAt, from, to));
  const cashRevenue = paid.reduce((a, s) => a + s.amount, 0);
  const refunded = subs.filter((s) => !s.grantedBy && s.paidAt && inRange(s.canceledAt, from, to)).reduce((a, s) => a + s.amount, 0);
  const cash = profitLine(cashRevenue - refunded, Math.round((tax.monthlyCostCents * periodDays) / MONTH_DAYS), paid.reduce((a, s) => a + feeOf(s, s.amount, r), 0), r);
  return {
    tax: { revenue_pct: r.revenue * 100, profit_pct: r.profit * 100, fee_pix_pct: Math.round(r.feePix * 10_000) / 100, fee_card_pct: Math.round(r.feeCard * 10_000) / 100, fee_source: tax.feeSource, monthly_cost_cents: tax.monthlyCostCents },
    period_days: Math.round(periodDays * 100) / 100,
    subscriptions: { rows, total: { ...total, annual_profit_cents: total.profit_cents * 12 } },
    cash: { ...cash, payments: paid.length, refunded_cents: refunded },
  };
}

/** Janela de arrependimento (7 dias): abertas agora, fechando em 48h, abertas e reembolsadas no período. */
export function refundJson(subs: SubRow[], now: Date, from: Date, to: Date) {
  const windowed = subs.filter((s) => s.paidAt && !s.grantedBy);
  let open = 0, closingSoon = 0, opened = 0, refunded = 0;
  const byPlan = new Map<string, number>(), byMethod = new Map<string, number>();
  const kinds = new Map<string, { opened: number; refunded: number }>();
  for (const s of windowed) {
    const closes = new Date(s.paidAt!.getTime() + REFUND_WINDOW_DAYS * DAY);
    const refundedInWindow = s.canceledAt !== null && s.canceledAt <= closes;
    const k = planName(s.planId);
    const kind = kinds.get(k) ?? { opened: 0, refunded: 0 };
    if (inRange(s.paidAt, from, to)) { opened += 1; kind.opened += 1; }
    if (refundedInWindow && inRange(s.canceledAt, from, to)) { refunded += 1; kind.refunded += 1; }
    kinds.set(k, kind);
    if (now < closes && !s.canceledAt && s.status === 'active') {
      open += 1;
      if (closes.getTime() - now.getTime() <= CLOSING_SOON_H * 3_600_000) closingSoon += 1;
      bump(byPlan, k);
      bump(byMethod, methodLabel(s));
    }
  }
  return {
    open, closing_soon: closingSoon, opened_in_range: opened, refunded_in_range: refunded, refund_rate: rate(refunded, opened),
    by_plan_rate: [...kinds.entries()].filter(([, v]) => v.opened || v.refunded).map(([name, v]) => ({ name, opened: v.opened, refunded: v.refunded, refund_rate: rate(v.refunded, v.opened) })),
    by_plan: countRows(byPlan), by_method: countRows(byMethod),
  };
}

/** Relatório de assinaturas (port de report_json + seções). */
export function subscriptionsJson(
  subs: SubRow[], users: Map<string, { university: string | null }>, identities: Map<string, string>,
  now: Date, from: Date, to: Date, tax: ReturnType<typeof resolveTax>,
) {
  const statuses = new Map<string, number>();
  const plans = new Map<string, { live: number; pix: number; card: number; renewing: number; mrr: number; granted: number }>();
  let live = 0, paying = 0, granted = 0, renewing = 0, mrr = 0, newInRange = 0, canceledInRange = 0, expiredInRange = 0;
  for (const s of subs) {
    bump(statuses, s.status);
    if (!s.grantedBy && inRange(s.paidAt, from, to)) newInRange += 1;
    if (inRange(s.canceledAt, from, to)) canceledInRange += 1;
    if (s.status === 'active' && inRange(s.expiresAt, from, to) && s.expiresAt! <= now) expiredInRange += 1;
    if (!liveAt(s, now)) continue;
    const row = plans.get(s.planId) ?? { live: 0, pix: 0, card: 0, renewing: 0, mrr: 0, granted: 0 };
    live += 1; row.live += 1;
    if (s.grantedBy) { granted += 1; row.granted += 1; }
    else if (s.paymentMethod === 'pix') row.pix += 1; else row.card += 1;
    if (s.expiresAt!.getTime() - now.getTime() <= 30 * DAY) { renewing += 1; row.renewing += 1; }
    if (payingAt(s, now)) { paying += 1; const m = monthlyCents(s); mrr += m; row.mrr += m; }
    plans.set(s.planId, row);
  }
  const started = subs.filter((s) => inRange(s.createdAt, from, to) && !s.grantedBy);
  const livePaying = subs.filter((s) => payingAt(s, now));
  const kinds = new Map<string, { count: number; mrr: number }>();
  const universities = new Map<string, number>();
  for (const s of livePaying) {
    const t = identities.get(s.userId);
    const kind = t === 'cnpj' ? 'business' : t === 'cpf' ? 'individual' : 'unknown';
    const e = kinds.get(kind) ?? { count: 0, mrr: 0 };
    e.count += 1; e.mrr += monthlyCents(s); kinds.set(kind, e);
    bump(universities, users.get(s.userId)?.university?.trim() || '(não informada)');
  }
  const revenueBy = (key: (s: SubRow) => string | null) => {
    const m = new Map<string, number>();
    for (const s of subs) if (!s.grantedBy && inRange(s.paidAt, from, to)) bump(m, key(s) ?? '(sem atribuição)', s.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, cents]) => ({ name, revenue_cents: cents }));
  };
  return {
    from: from.toISOString(), to: to.toISOString(),
    live, paying, granted, renewing_30d: renewing, mrr_cents: mrr, arr_cents: mrr * 12, arpa_cents: paying ? Math.round(mrr / paying) : 0,
    new_in_range: newInRange, canceled_in_range: canceledInRange, expired_in_range: expiredInRange,
    statuses: Object.fromEntries(statuses),
    plans: PLANS.map((p) => ({ plan: p.name, ...(plans.get(p.id) ?? { live: 0, pix: 0, card: 0, renewing: 0, mrr: 0, granted: 0 }) }))
      .map((p) => ({ plan: p.plan, pix: p.pix, card: p.card, granted: p.granted, total: p.live, renewing: p.renewing, mrr_cents: p.mrr })),
    checkout: {
      totals: funnelRows(started, () => 'total')[0] ?? null,
      by_plan: funnelRows(started, (s) => planName(s.planId)),
      by_method: funnelRows(started, (s) => methodLabel(s)),
      by_installments: funnelRows(started, (s) => (s.paymentMethod === 'pix' ? 'Pix' : installmentsLabel(s))),
      by_landing: funnelRows(started, (s) => s.lp ?? '(sem landing)'),
      by_source: funnelRows(started, (s) => s.utmSource ?? '(direto)'),
    },
    attribution: { by_source: revenueBy((s) => s.utmSource), by_campaign: revenueBy((s) => s.utmCampaign), by_landing: revenueBy((s) => s.lp) },
    refund: refundJson(subs, now, from, to),
    profit: profitJson(subs, now, from, to, tax),
    customers: {
      by_kind: [...kinds.entries()].map(([name, v]) => ({ name, count: v.count, mrr_cents: v.mrr })),
      by_university: countRows(universities).slice(0, 15),
      by_method: countRows(livePaying.reduce((m, s) => bump(m, methodLabel(s)), new Map<string, number>())),
    },
  };
}

/** Histórico diário de MRR, assinantes pagantes e receita no período. */
export function mrrSeries(subs: SubRow[], from: Date, to: Date) {
  const out: { day: string; mrr_cents: number; paying: number; revenue_cents: number; new_subs: number }[] = [];
  for (let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())); d < to; d = new Date(d.getTime() + DAY)) {
    const end = new Date(Math.min(d.getTime() + DAY, to.getTime()) - 1);
    let mrr = 0, paying = 0, revenue = 0, fresh = 0;
    for (const s of subs) {
      if (payingAt(s, end)) { mrr += monthlyCents(s); paying += 1; }
      if (!s.grantedBy && inRange(s.paidAt, d, new Date(d.getTime() + DAY))) { revenue += s.amount; fresh += 1; }
      if (!s.grantedBy && s.paidAt && inRange(s.canceledAt, d, new Date(d.getTime() + DAY))) revenue -= s.amount;
    }
    out.push({ day: d.toISOString().slice(0, 10), mrr_cents: mrr, paying, revenue_cents: revenue, new_subs: fresh });
  }
  return out;
}
