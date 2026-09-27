import { FormEvent, useState } from 'react';
import { Bar, brl, formatPct, get, Kpi, lastDays, Loading, Note, num, query, Range, RangePicker, Section, Table, useReport } from './common';

interface Line { revenue_cents: number; cost_cents: number; fee_cents: number; revenue_tax_cents: number; profit_tax_cents: number; tax_cents: number; profit_cents: number; margin: number }
interface FunnelRow { name: string; started: number; completed: number; open: number; failed: number; conversion: number; revenue_cents: number }
interface Data {
  live: number; paying: number; granted: number; renewing_30d: number; mrr_cents: number; arr_cents: number; arpa_cents: number;
  new_in_range: number; canceled_in_range: number; expired_in_range: number; statuses: Record<string, number>;
  plans: { plan: string; pix: number; card: number; granted: number; total: number; renewing: number; mrr_cents: number }[];
  checkout: { totals: FunnelRow | null; by_plan: FunnelRow[]; by_method: FunnelRow[]; by_installments: FunnelRow[]; by_landing: FunnelRow[]; by_source: FunnelRow[] };
  attribution: Record<'by_source' | 'by_campaign' | 'by_landing', { name: string; revenue_cents: number }[]>;
  refund: { open: number; closing_soon: number; opened_in_range: number; refunded_in_range: number; refund_rate: number; by_plan_rate: { name: string; opened: number; refunded: number; refund_rate: number }[]; by_plan: { name: string; count: number }[]; by_method: { name: string; count: number }[] };
  profit: {
    tax: { revenue_pct: number; profit_pct: number; fee_pix_pct: number; fee_card_pct: number; fee_source: string; monthly_cost_cents: number };
    period_days: number;
    subscriptions: { rows: (Line & { name: string; subscriptions: number; profit_per_sub_cents: number })[]; total: Line & { subscriptions: number; annual_profit_cents: number } };
    cash: Line & { payments: number; refunded_cents: number };
  };
  customers: { by_kind: { name: string; count: number; mrr_cents: number }[]; by_university: { name: string; count: number }[]; by_method: { name: string; count: number }[] };
}
interface Tax { revenue_tax: string; profit_tax: string; payment_fee: string; monthly_cost: string }
const NO_TAX: Tax = { revenue_tax: '', profit_tax: '', payment_fee: '', monthly_cost: '' };
// Presets de regime tributário (aproximações para simulação; confirme com a contabilidade).
const REGIMES: [string, Partial<Tax>][] = [
  ['Configurado', {}],
  ['Simples Nacional (Anexo III, 6%)', { revenue_tax: '6', profit_tax: '0' }],
  ['Simples Nacional (Anexo V, 15,5%)', { revenue_tax: '15.5', profit_tax: '0' }],
  ['Lucro Presumido (~16,33%)', { revenue_tax: '16.33', profit_tax: '0' }],
  ['Lucro Real (9,25% + 34%)', { revenue_tax: '9.25', profit_tax: '34' }],
];

function TaxBar({ value, onChange, current }: { value: Tax; onChange(t: Tax): void; current: Data['profit']['tax'] | undefined }) {
  const [draft, setDraft] = useState(value);
  const submit = (e: FormEvent) => { e.preventDefault(); onChange(draft); };
  const set = (k: keyof Tax) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value });
  return (
    <form className="c-toolbar c-segment" onSubmit={submit}>
      <label className="c-field">Regime
        <select onChange={(e) => { const next = { ...NO_TAX, ...REGIMES[Number(e.target.value)][1], payment_fee: draft.payment_fee, monthly_cost: draft.monthly_cost }; setDraft(next); onChange(next); }}>
          {REGIMES.map(([n], i) => <option key={n} value={i}>{n}</option>)}
        </select>
      </label>
      <label className="c-field">Imposto s/ receita %<input inputMode="decimal" value={draft.revenue_tax} placeholder={String(current?.revenue_pct ?? '')} onChange={set('revenue_tax')} /></label>
      <label className="c-field">Imposto s/ lucro %<input inputMode="decimal" value={draft.profit_tax} placeholder={String(current?.profit_pct ?? '')} onChange={set('profit_tax')} /></label>
      <label className="c-field">Taxa do gateway %<input inputMode="decimal" value={draft.payment_fee} placeholder={current ? `Pix ${current.fee_pix_pct} / cartão ${current.fee_card_pct}` : ''} onChange={set('payment_fee')} /></label>
      <label className="c-field">Custo fixo mensal (R$)<input inputMode="decimal" value={draft.monthly_cost} placeholder={current ? String(current.monthly_cost_cents / 100) : ''} onChange={set('monthly_cost')} /></label>
      <button className="btn btn-outline">Simular</button>
      {Object.values(value).some(Boolean) && <button type="button" className="btn btn-text" onClick={() => { setDraft(NO_TAX); onChange(NO_TAX); }}>Voltar ao configurado</button>}
    </form>
  );
}

const funnel = (rows: FunnelRow[], label: string) => (
  <Table head={[label, 'Iniciados', 'Pagos', 'Pendentes', 'Falharam', 'Conversão', 'Receita']}
    rows={rows.map((f) => [<b>{f.name}</b>, num(f.started), num(f.completed), num(f.open), num(f.failed), formatPct(f.conversion), brl(f.revenue_cents)])} />
);
const profitHead = ['', 'Assinaturas', 'Receita', 'Taxas gateway', 'Impostos', 'Custos', 'Lucro', 'Margem'];
const profitRow = (name: string, l: Line & { subscriptions?: number }) =>
  [<b>{name}</b>, l.subscriptions !== undefined ? num(l.subscriptions) : '—', brl(l.revenue_cents), brl(l.fee_cents), brl(l.tax_cents), brl(l.cost_cents), <b className={l.profit_cents < 0 ? 'neg' : ''}>{brl(l.profit_cents)}</b>, formatPct(l.margin)];
const revenueTable = (rows: { name: string; revenue_cents: number }[], label: string) => (
  <Table head={[label, 'Receita']} rows={rows.map((r) => [r.name, <Bar value={r.revenue_cents} max={rows[0].revenue_cents} label={brl(r.revenue_cents)} />])} />
);
const KIND: Record<string, string> = { individual: 'Pessoa física (CPF)', business: 'Empresa (CNPJ)', unknown: 'Sem dados fiscais' };

/** Assinaturas — port de Subscriptions.tsx: MRR/ARR, planos, lucro real, reembolsos, funis e atribuição. */
export default function Subscriptions() {
  const [range, setRange] = useState<Range>(lastDays(30));
  const [tax, setTax] = useState<Tax>(NO_TAX);
  const r = useReport(() => get<Data>(`/admin/subscriptions?${query(range, undefined, { ...tax })}`), JSON.stringify([range, tax]));
  const d = r.data;
  return (
    <>
      <RangePicker value={range} onChange={setRange} />
      {!d ? <Loading {...r} /> : (
        <>
          <div className="c-kpis">
            <Kpi accent label="MRR" value={brl(d.mrr_cents)} /><Kpi accent label="ARR" value={brl(d.arr_cents)} />
            <Kpi label="Pagantes" value={num(d.paying)} /><Kpi label="Cortesias" value={num(d.granted)} />
            <Kpi label="ARPA mensal" value={brl(d.arpa_cents)} /><Kpi label="Novas no período" value={num(d.new_in_range)} />
            <Kpi label="Canceladas no período" value={num(d.canceled_in_range)} /><Kpi label="Expiradas no período" value={num(d.expired_in_range)} />
            <Kpi label="Vencem em 30 dias" value={num(d.renewing_30d)} />
          </div>
          <Section title="Assinaturas ativas por plano">
            <Table head={['Plano', 'Pix', 'Cartão', 'Cortesia', 'Total', 'Vencem em 30 dias', 'MRR']}
              rows={d.plans.map((p) => [<b>{p.plan}</b>, num(p.pix), num(p.card), num(p.granted), num(p.total), num(p.renewing), brl(p.mrr_cents)])} />
            <Note>Status (todas as assinaturas): {Object.entries(d.statuses).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}</Note>
          </Section>

          <Section title="Lucro real" note="Base mensal = MRR menos taxas do gateway, impostos e custos fixos rateados. Simule regimes abaixo; os valores configurados vêm do .env (ADMIN_*).">
            <TaxBar value={tax} onChange={setTax} current={d.profit.tax} />
            <div className="c-kpis small">
              <Kpi accent label="Lucro mensal" value={brl(d.profit.subscriptions.total.profit_cents)} />
              <Kpi label="Lucro anualizado" value={brl(d.profit.subscriptions.total.annual_profit_cents)} />
              <Kpi label="Margem" value={formatPct(d.profit.subscriptions.total.margin)} />
              <Kpi label={`Caixa em ${String(d.profit.period_days).replace('.', ',')} dias`} value={brl(d.profit.cash.profit_cents)} hint="Pagamentos recebidos no período menos reembolsos, taxas, impostos e custos proporcionais" />
            </div>
            <Table head={profitHead} rows={[
              ...d.profit.subscriptions.rows.map((row) => profitRow(row.name, row)),
              profitRow('Total mensal', d.profit.subscriptions.total),
              profitRow(`Caixa do período (${num(d.profit.cash.payments)} pagamentos)`, d.profit.cash),
            ]} />
          </Section>

          <Section title="Direito de arrependimento (7 dias, CDC)">
            <div className="c-kpis small">
              <Kpi label="Janelas abertas" value={num(d.refund.open)} /><Kpi label="Fecham em 48h" value={num(d.refund.closing_soon)} />
              <Kpi label="Compras no período" value={num(d.refund.opened_in_range)} /><Kpi label="Reembolsadas" value={num(d.refund.refunded_in_range)} />
              <Kpi label="Taxa de reembolso" value={formatPct(d.refund.refund_rate)} />
            </div>
            <Table head={['Plano', 'Compras', 'Reembolsos', 'Taxa']} rows={d.refund.by_plan_rate.map((x) => [x.name, num(x.opened), num(x.refunded), formatPct(x.refund_rate)])} />
          </Section>

          <Section title="Funil de checkout">
            {d.checkout.totals && <Note>{num(d.checkout.totals.started)} checkouts iniciados, {num(d.checkout.totals.completed)} pagos ({formatPct(d.checkout.totals.conversion)}).</Note>}
            {funnel(d.checkout.by_plan, 'Plano')}
            <div className="c-grid2">
              <div>{funnel(d.checkout.by_method, 'Forma de pagamento')}</div>
              <div>{funnel(d.checkout.by_installments, 'Parcelamento')}</div>
              <div>{funnel(d.checkout.by_source, 'Fonte UTM')}</div>
              <div>{funnel(d.checkout.by_landing, 'Landing')}</div>
            </div>
          </Section>

          <Section title="Atribuição de receita" note="Primeira UTM/landing registrada no navegador do comprador (só com consentimento).">
            <div className="c-grid3">
              <div>{revenueTable(d.attribution.by_source, 'Fonte')}</div>
              <div>{revenueTable(d.attribution.by_campaign, 'Campanha')}</div>
              <div>{revenueTable(d.attribution.by_landing, 'Landing')}</div>
            </div>
          </Section>

          <Section title="Quem são os pagantes">
            <div className="c-grid3">
              <Table head={['Tipo', 'Qtd.', 'MRR']} rows={d.customers.by_kind.map((k) => [KIND[k.name] ?? k.name, num(k.count), brl(k.mrr_cents)])} />
              <Table head={['Faculdade', 'Qtd.']} rows={d.customers.by_university.map((k) => [k.name, num(k.count)])} />
              <Table head={['Pagamento', 'Qtd.']} rows={d.customers.by_method.map((k) => [k.name, num(k.count)])} />
            </div>
          </Section>
        </>
      )}
    </>
  );
}
