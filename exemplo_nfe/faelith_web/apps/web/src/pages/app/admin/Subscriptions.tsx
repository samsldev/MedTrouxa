/**
 * @fileoverview Admin Subscriptions tab: live Stripe subscriptions per plan and interval, MRR, churn, and checkout funnel.
 * @author Samuel S. L.
 * @version 1.4.0
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
 * - Data comes live from Stripe through GET /api/admin/subscriptions (no local copy)
 * - KPIs: live subscriptions, monthly vs yearly, MRR and ARR at list price, scheduled cancellations, new and canceled
 * - Refund windows: open now by plan / interval, by length (7d, 14d), by length and plan, by country; refund rate
 * - Real profit: revenue - provider cost - payment fees (measured in Stripe) - tax on revenue - tax on profit (editable rates with regime presets,
 *   remembered per browser), per plan / interval (monthly) and for pure API and overage usage
 * - Buyer mix: business vs individual (Checkout tax id) and billing country
 * - Tables: plan mix (monthly, yearly, MRR), Stripe statuses, and checkout funnel by plan, landing page, and offer
 */

import { useState, type FormEvent, type ReactNode } from 'react';
import {
  fetchSubscriptions,
  type FunnelRow,
  type NameCount,
  type ProfitLine,
  type ProfitReport,
  type Range,
  type RefundReport,
  type SubscriptionsReport,
  type TaxRates,
} from '../../../lib/adminApi';
import { formatUsd } from '../../../lib/format';
import { useT } from '../../../lib/i18n';
import styles from './Admin.module.css';
import { formatPct, T } from './adminI18n';
import { useReport } from './useReport';

/**
 * One checkout funnel table (started, completed, still open, conversion).
 */
function FunnelTable({ title, rows }: { title: string; rows: FunnelRow[] }) {
  const t = useT(T);
  const s = t.subs;
  if (rows.length === 0) return null;
  return (
    <>
      <h2 className={styles.section}>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.cols.name}</th>
              <th className={styles.num}>{s.started}</th>
              <th className={styles.num}>{s.completed}</th>
              <th className={styles.num}>{s.open}</th>
              <th className={styles.num}>{s.conversion}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td className={styles.num}>{row.started}</td>
                <td className={styles.num}>{row.completed}</td>
                <td className={styles.num}>{row.open}</td>
                <td className={styles.num}>{formatPct(row.conversion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Money cells of one profit line, in table order. */
function moneyCells(line: ProfitLine) {
  return (
    <>
      <td className={styles.num}>{formatUsd(line.revenue_cents / 100)}</td>
      <td className={styles.num}>{formatUsd(line.cost_cents / 100)}</td>
      <td className={styles.num}>{formatUsd(line.fee_cents / 100)}</td>
      <td className={styles.num}>{formatUsd(line.revenue_tax_cents / 100)}</td>
      <td className={styles.num}>{formatUsd(line.profit_tax_cents / 100)}</td>
      <td className={styles.num}>
        <strong>{formatUsd(line.profit_cents / 100)}</strong>
      </td>
      <td className={styles.num}>{formatPct(line.margin)}</td>
    </>
  );
}

/**
 * Real profit: KPIs, subscriptions per plan / interval (monthly), pure API and overage (period).
 */
function ProfitSection({ profit, controls }: { profit: ProfitReport; controls: ReactNode }) {
  const t = useT(T);
  const p = t.profit;
  const total = profit.subscriptions.total;
  const kpis: [string, string][] = [
    [p.monthlyProfit, formatUsd(total.profit_cents / 100)],
    [p.annual, formatUsd(total.annual_profit_cents / 100)],
    [p.margin, formatPct(total.margin)],
    [p.apiProfit, formatUsd(profit.api.profit_cents / 100)],
  ];
  const head = (
    <>
      <th className={styles.num}>{p.revenue}</th>
      <th className={styles.num}>{p.cost}</th>
      <th className={styles.num}>{p.fee}</th>
      <th className={styles.num}>{p.revenueTax}</th>
      <th className={styles.num}>{p.profitTax}</th>
      <th className={styles.num}>{p.profit}</th>
      <th className={styles.num}>{p.margin}</th>
    </>
  );
  return (
    <>
      <h2 className={styles.section}>{p.title}</h2>
      <div className={styles.kpis}>
        {kpis.map(([label, value]) => (
          <div key={label} className={styles.kpi}>
            <div className={styles.kpiLabel}>{label}</div>
            <div className={styles.kpiValue}>{value}</div>
          </div>
        ))}
      </div>
      {controls}
      <p className={styles.note}>{p.note(profit.tax.revenue_pct, profit.tax.profit_pct, profit.period_days)}</p>
      <p className={styles.note}>{p.feeSource(profit.tax.payment_fee_pct, profit.tax.payment_fee_source)}</p>

      <h2 className={styles.section}>{p.subsTitle}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{p.type}</th>
              <th className={styles.num}>{p.subscriptions}</th>
              {head}
              <th className={styles.num}>{p.perSub}</th>
            </tr>
          </thead>
          <tbody>
            {profit.subscriptions.rows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td className={styles.num}>{row.subscriptions}</td>
                {moneyCells(row)}
                <td className={styles.num}>{formatUsd(row.profit_per_sub_cents / 100)}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>{p.total}</strong>
              </td>
              <td className={styles.num}>{total.subscriptions}</td>
              {moneyCells(total)}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className={styles.section}>{p.apiTitle}</h2>
      <p className={styles.note}>{p.apiNote}</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className={styles.num}>{p.requests}</th>
              <th className={styles.num}>{p.orgs}</th>
              {head}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.num}>{profit.api.requests}</td>
              <td className={styles.num}>{profit.api.orgs}</td>
              {moneyCells(profit.api)}
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className={styles.section}>{p.overageTitle}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className={styles.num}>{p.requests}</th>
              {head}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.num}>{profit.overage.requests}</td>
              {moneyCells(profit.overage)}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Buyer mix of live subscriptions: business vs individual with MRR, then country and tax id type.
 */
function BuyersSection({ customers }: { customers: SubscriptionsReport['customers'] }) {
  const t = useT(T);
  const b = t.buyers;
  return (
    <>
      <h2 className={styles.section}>{b.title}</h2>
      <p className={styles.note}>{b.note}</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{b.kind}</th>
              <th className={styles.num}>{b.count}</th>
              <th className={styles.num}>{b.mrr}</th>
            </tr>
          </thead>
          <tbody>
            {customers.by_kind.map((row) => (
              <tr key={row.name}>
                <td>{b.kinds[row.name] ?? row.name}</td>
                <td className={styles.num}>{row.count}</td>
                <td className={styles.num}>{formatUsd(row.mrr_cents / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CountTable title={b.countries} rows={customers.by_country} />
      <CountTable title={b.taxIds} rows={customers.by_tax_id} />
    </>
  );
}

/**
 * Two-column ranking table (name, subscriptions).
 */
function CountTable({ title, rows }: { title: string; rows: NameCount[] }) {
  const t = useT(T);
  if (rows.length === 0) return null;
  return (
    <>
      <h2 className={styles.section}>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.cols.name}</th>
              <th className={styles.num}>{t.refund.count}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td className={styles.num}>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Refund window section: KPIs, per-length table, and open windows by plan, length and plan, and country.
 */
function RefundSection({ refund }: { refund: RefundReport }) {
  const t = useT(T);
  const r = t.refund;
  const kpis: [string, string][] = [
    [r.open, String(refund.open)],
    [r.opened, String(refund.opened_in_range)],
    [r.refunded, String(refund.refunded_in_range)],
    [r.rate, formatPct(refund.refund_rate)],
  ];
  return (
    <>
      <div className={styles.kpis}>
        {kpis.map(([label, value]) => (
          <div key={label} className={styles.kpi}>
            <div className={styles.kpiLabel}>{label}</div>
            <div className={styles.kpiValue}>{value}</div>
          </div>
        ))}
      </div>
      <p className={styles.note}>{r.note}</p>
      {refund.by_kind.length > 0 ? (
        <>
          <h2 className={styles.section}>{r.byKind}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{r.kind}</th>
                  <th className={styles.num}>{r.openNow}</th>
                  <th className={styles.num}>{r.closingSoon}</th>
                  <th className={styles.num}>{r.opened}</th>
                  <th className={styles.num}>{r.refunded}</th>
                  <th className={styles.num}>{r.rate}</th>
                </tr>
              </thead>
              <tbody>
                {refund.by_kind.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td className={styles.num}>{row.open}</td>
                    <td className={styles.num}>{row.closing_soon}</td>
                    <td className={styles.num}>{row.opened}</td>
                    <td className={styles.num}>{row.refunded}</td>
                    <td className={styles.num}>{formatPct(row.refund_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <CountTable title={r.byPlan} rows={refund.by_plan} />
      <CountTable title={r.byKindPlan} rows={refund.by_kind_plan} />
      <CountTable title={r.byCountry} rows={refund.by_country} />
    </>
  );
}

const TAX_KEY = 'fae.admin.tax';

/** Regime presets in percent (revenue, profit); indicative, confirm with the accountant. */
const REGIMES: { key: 'simples' | 'presumido' | 'real'; rates: { revenue: number; profit: number } }[] = [
  { key: 'simples', rates: { revenue: 6, profit: 0 } },
  { key: 'presumido', rates: { revenue: 15, profit: 0 } },
  { key: 'real', rates: { revenue: 12, profit: 34 } },
];

/**
 * Saved tax rates of this browser; null uses the server defaults.
 */
function readTax(): TaxRates | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TAX_KEY) ?? 'null') as TaxRates | null;
    if (!parsed || !Number.isFinite(parsed.revenue) || !Number.isFinite(parsed.profit)) return null;
    return { ...parsed, fee: Number.isFinite(parsed.fee) ? parsed.fee : null };
  } catch {
    return null;
  }
}

/**
 * Remembers the chosen rates (storage failures only lose the preference).
 */
function saveTax(rates: TaxRates): void {
  try {
    window.localStorage.setItem(TAX_KEY, JSON.stringify(rates));
  } catch {
    // Private mode or blocked storage: the rates still apply to this view.
  }
}

/**
 * Revenue / profit tax inputs with regime presets.
 */
function TaxBar({
  applied,
  onApply,
}: {
  applied: ProfitReport['tax'];
  onApply: (rates: TaxRates) => void;
}) {
  const t = useT(T);
  const p = t.profit;
  const [revenue, setRevenue] = useState(String(applied.revenue_pct));
  const [profit, setProfit] = useState(String(applied.profit_pct));
  // Empty means "use the fee measured in Stripe".
  const [fee, setFee] = useState(applied.payment_fee_source === 'override' ? String(applied.payment_fee_pct) : '');
  const feeValue = fee.trim() === '' ? null : Number(fee) || 0;

  /** Applies the typed rates. */
  function submit(event: FormEvent) {
    event.preventDefault();
    onApply({ revenue: Number(revenue) || 0, profit: Number(profit) || 0, fee: feeValue });
  }

  return (
    <form className={styles.toolbar} onSubmit={submit}>
      {REGIMES.map((regime) => (
        <button
          key={regime.key}
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setRevenue(String(regime.rates.revenue));
            setProfit(String(regime.rates.profit));
            onApply({ ...regime.rates, fee: feeValue });
          }}
        >
          {p.regimes[regime.key]}
        </button>
      ))}
      <label className="field">
        <span>{p.revenueTax} (%)</span>
        <input type="number" min={0} max={100} step="0.1" value={revenue} onChange={(event) => setRevenue(event.target.value)} />
      </label>
      <label className="field">
        <span>{p.profitTax} (%)</span>
        <input type="number" min={0} max={100} step="0.1" value={profit} onChange={(event) => setProfit(event.target.value)} />
      </label>
      <label className="field">
        <span>{p.fee} (%)</span>
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={fee}
          placeholder={`${applied.payment_fee_pct} (${p.feeAuto})`}
          onChange={(event) => setFee(event.target.value)}
        />
      </label>
      <button type="submit" className="btn btn-ghost btn-sm">
        {p.applyTax}
      </button>
    </form>
  );
}

/**
 * Subscriptions report for the selected period (new, canceled, and funnel use the period; the mix is current).
 */
export function SubscriptionsTab({ range }: { range: Range }) {
  const t = useT(T);
  const s = t.subs;
  const [tax, setTax] = useState<TaxRates | null>(readTax);
  const { data, error, loading } = useReport(
    () => fetchSubscriptions(range, tax),
    `${range.from}|${range.to}|${tax ? `${tax.revenue}/${tax.profit}/${tax.fee ?? 'auto'}` : 'default'}`,
    t.failed,
  );

  /** Applies and remembers new tax rates. */
  function applyTax(rates: TaxRates) {
    saveTax(rates);
    setTax(rates);
  }

  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data) return <p className={styles.note}>{loading ? t.loading : t.empty}</p>;
  const kpis: [string, string][] = [
    [s.live, String(data.live)],
    [s.monthly, String(data.monthly)],
    [s.yearly, String(data.yearly)],
    [s.mrr, formatUsd(data.mrr_cents / 100)],
    [s.arr, formatUsd(data.arr_cents / 100)],
    [s.scheduled, String(data.cancel_scheduled)],
    [s.newInRange, String(data.new_in_range)],
    [s.canceledInRange, String(data.canceled_in_range)],
  ];
  return (
    <>
      <div className={styles.kpis}>
        {kpis.map(([label, value]) => (
          <div key={label} className={styles.kpi}>
            <div className={styles.kpiLabel}>{label}</div>
            <div className={styles.kpiValue}>{value}</div>
          </div>
        ))}
      </div>
      <p className={styles.note}>{s.note}</p>

      <h2 className={styles.section}>{s.byPlan}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{s.plan}</th>
              <th className={styles.num}>{s.monthly}</th>
              <th className={styles.num}>{s.yearly}</th>
              <th className={styles.num}>{s.total}</th>
              <th className={styles.num}>{s.scheduled}</th>
              <th className={styles.num}>{s.mrr}</th>
            </tr>
          </thead>
          <tbody>
            {data.plans.map((row) => (
              <tr key={row.plan}>
                <td>{row.plan}</td>
                <td className={styles.num}>{row.monthly}</td>
                <td className={styles.num}>{row.yearly}</td>
                <td className={styles.num}>{row.total}</td>
                <td className={styles.num}>{row.cancel_scheduled}</td>
                <td className={styles.num}>{formatUsd(row.mrr_cents / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProfitSection
        profit={data.profit}
        controls={
          <TaxBar
            key={`${data.profit.tax.revenue_pct}/${data.profit.tax.profit_pct}/${data.profit.tax.payment_fee_pct}`}
            applied={data.profit.tax}
            onApply={applyTax}
          />
        }
      />

      <BuyersSection customers={data.customers} />

      <RefundSection refund={data.refund} />

      <h2 className={styles.section}>{s.statuses}</h2>
      <div className="table-wrap">
        <table>
          <tbody>
            {Object.entries(data.statuses).map(([status, count]) => (
              <tr key={status}>
                <td className="mono">{status}</td>
                <td className={styles.num}>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FunnelTable title={s.funnelPlan} rows={data.checkout.by_plan} />
      <FunnelTable title={s.funnelLanding} rows={data.checkout.by_landing} />
      <FunnelTable title={s.funnelOffer} rows={data.checkout.by_offer} />
    </>
  );
}
