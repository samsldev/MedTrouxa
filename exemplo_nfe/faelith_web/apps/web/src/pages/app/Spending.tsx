/**
 * @fileoverview Spending view comparing prepaid wallet against plan usage events.
 * @author Samuel S. L.
 * @version 1.5.0
 * @since 2026-09-06
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
 * DETAILED_DESCRIPTION:
 * - Loads GET /api/spending
 * - Contrasts wallet balance with the attached plan
 * - Renders the usage_events table when present
 * - Tokens column: compact total, hover breakdown (cache read / write, input, output)
 * - Top up: $10 / $50 / $100 packs or a custom amount ($5 minimum) via Stripe Checkout
 * - Usage-based overage toggle (moved from Billing)
 * - Amount shows "Included" for plan allowance and the debited USD for credits (API keys, overage)
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useEffect, useState } from 'react';
import { ApiError, fetchBilling, fetchSpending, setUsageBased, startCheckout } from '../../lib/api';
import { formatUsdMicros } from '../../lib/format';
import { useT, type Dict } from '../../lib/i18n';
import { planDisplayName } from '../../lib/plans';
import type { CheckoutBody, CreditPack, SpendingResponse, UsageTokens } from '../../lib/types';
import styles from './Dashboard.module.css';

const PACKS: CreditPack[] = ['10', '50', '100'];
/** Custom top-up bounds in USD; the server enforces the same limits. */
const MIN_TOPUP_USD = 5;
const MAX_TOPUP_USD = 10_000;

interface SpendingStrings {
  breakdown: { cacheRead: string; cacheWrite: string; input: string; output: string; total: string };
  checkoutFailed: string;
  toggleFailed: string;
  loadFailed: string;
  kicker: string;
  title: string;
  wallet: string;
  walletHelp: string;
  plan: string;
  noPlan: string;
  planHelp: string;
  packs: string;
  custom: string;
  customAria: string;
  add: string;
  customRange: (min: number, max: string) => string;
  overage: string;
  overageHelp: string;
  enable: string;
  disable: string;
  events: string;
  cols: [string, string, string, string, string];
  noEvents: string;
  included: string;
  includedTitle: (amount: string) => string;
}

const T: Dict<SpendingStrings> = {
  en: {
    breakdown: { cacheRead: 'Cache Read', cacheWrite: 'Cache Write', input: 'Input', output: 'Output', total: 'Total' },
    checkoutFailed: 'Checkout failed',
    toggleFailed: 'Unable to update usage-based setting',
    loadFailed: 'Unable to load spending',
    kicker: 'Spending',
    title: 'Wallet and events',
    wallet: 'Prepaid wallet',
    walletHelp: 'Debited by API keys and opt-in overage.',
    plan: 'Plan',
    noPlan: 'No plan',
    planHelp: 'Included allowance renews on the 5-hour and weekly windows.',
    packs: 'Credit packs',
    custom: 'Custom',
    customAria: 'Custom amount in USD',
    add: 'Add',
    customRange: (min, max) => `Custom amounts from $${min}.00 to $${max}.00.`,
    overage: 'Usage-based overage',
    overageHelp: 'When included allowance is exhausted, debit prepaid credits instead of returning a plan limit error.',
    enable: 'Enable',
    disable: 'Disable',
    events: 'Usage events',
    cols: ['When', 'Purpose', 'Source', 'Tokens', 'Amount'],
    noEvents: 'No usage events.',
    included: 'Included',
    includedTitle: (amount) => `List value ${amount}, covered by your plan`,
  },
  br: {
    breakdown: { cacheRead: 'Cache read', cacheWrite: 'Cache write', input: 'Input', output: 'Output', total: 'Total' },
    checkoutFailed: 'Não foi possível abrir o pagamento',
    toggleFailed: 'Não foi possível atualizar o excedente por uso',
    loadFailed: 'Não foi possível carregar os gastos',
    kicker: 'Gastos',
    title: 'Carteira e eventos',
    wallet: 'Carteira pré-paga',
    walletHelp: 'Debitada pelas chaves de API e pelo excedente opcional.',
    plan: 'Plano',
    noPlan: 'Sem plano',
    planHelp: 'O limite incluído renova nas janelas de 5 horas e semanal.',
    packs: 'Pacotes de créditos',
    custom: 'Outro valor',
    customAria: 'Valor personalizado em USD',
    add: 'Adicionar',
    customRange: (min, max) => `Valores personalizados de US$ ${min},00 a US$ ${max},00.`,
    overage: 'Excedente por uso',
    overageHelp: 'Quando o limite incluído acabar, debitar créditos pré-pagos em vez de retornar um erro de limite do plano.',
    enable: 'Ativar',
    disable: 'Desativar',
    events: 'Eventos de uso',
    cols: ['Quando', 'Finalidade', 'Origem', 'Tokens', 'Valor'],
    noEvents: 'Nenhum evento de uso.',
    included: 'Incluído',
    includedTitle: (amount) => `Valor de tabela ${amount}, coberto pelo seu plano`,
  },
  pt: {
    breakdown: { cacheRead: 'Cache read', cacheWrite: 'Cache write', input: 'Input', output: 'Output', total: 'Total' },
    checkoutFailed: 'Não foi possível abrir o pagamento',
    toggleFailed: 'Não foi possível atualizar o excedente por utilização',
    loadFailed: 'Não foi possível carregar os gastos',
    kicker: 'Gastos',
    title: 'Carteira e eventos',
    wallet: 'Carteira pré-paga',
    walletHelp: 'Debitada pelas chaves de API e pelo excedente opcional.',
    plan: 'Plano',
    noPlan: 'Sem plano',
    planHelp: 'O limite incluído renova-se nas janelas de 5 horas e semanal.',
    packs: 'Pacotes de créditos',
    custom: 'Outro valor',
    customAria: 'Valor personalizado em USD',
    add: 'Adicionar',
    customRange: (min, max) => `Valores personalizados de ${min},00 USD a ${max},00 USD.`,
    overage: 'Excedente por utilização',
    overageHelp: 'Quando o limite incluído acabar, debitar créditos pré-pagos em vez de devolver um erro de limite do plano.',
    enable: 'Ativar',
    disable: 'Desativar',
    events: 'Eventos de utilização',
    cols: ['Quando', 'Finalidade', 'Origem', 'Tokens', 'Valor'],
    noEvents: 'Sem eventos de utilização.',
    included: 'Incluído',
    includedTitle: (amount) => `Valor de tabela ${amount}, coberto pelo seu plano`,
  },
};

/**
 * Parses a typed USD amount into cents, or null when it is not a valid top-up.
 */
function topupCents(raw: string): number | null {
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value < MIN_TOPUP_USD || value > MAX_TOPUP_USD) {
    return null;
  }
  return Math.round(value * 100);
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const exact = new Intl.NumberFormat();

/** Hovered token cell: its breakdown and where to anchor the popover. */
type TokenHover = { tokens: UsageTokens; right: number; top: number };

/**
 * Fixed-position breakdown so the scrolling table wrapper cannot clip it.
 */
function TokenBreakdown({ hover, t }: { hover: TokenHover; t: SpendingStrings }) {
  const rows: Array<[string, number]> = [
    [t.breakdown.cacheRead, hover.tokens.cacheRead],
    [t.breakdown.cacheWrite, hover.tokens.cacheWrite],
    [t.breakdown.input, hover.tokens.input],
    [t.breakdown.output, hover.tokens.output],
  ];
  return (
    <div className={styles.tokenPopover} style={{ top: hover.top, right: hover.right }} role="tooltip">
      {rows.map(([label, value]) => (
        <div key={label} className={styles.tokenRow}>
          <span>{label}</span>
          <span>{exact.format(value)}</span>
        </div>
      ))}
      <div className={`${styles.tokenRow} ${styles.tokenTotal}`}>
        <span>{t.breakdown.total}</span>
        <span>{exact.format(hover.tokens.total)}</span>
      </div>
    </div>
  );
}

/**
 * Authenticated spending page.
 */
export function SpendingPage() {
  const t = useT(T);
  const [data, setData] = useState<SpendingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<TokenHover | null>(null);
  const [usageBased, setUsageBasedState] = useState<boolean | null>(null);
  const [custom, setCustom] = useState('');
  const [pending, setPending] = useState(false);
  const customCents = topupCents(custom);

  useEffect(() => {
    fetchBilling()
      .then((billing) => setUsageBasedState(billing.usageBased))
      .catch(() => setUsageBasedState(null));
  }, []);

  /**
   * Starts a one-off Stripe Checkout for a pack or a custom amount and leaves for Stripe.
   */
  async function onTopUp(body: CheckoutBody) {
    setPending(true);
    setError(null);
    try {
      window.location.href = await startCheckout(body);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.checkoutFailed);
      setPending(false);
    }
  }

  /**
   * Persists the usage-based overage flag (may ask the user to confirm it is them).
   */
  async function onToggle(enabled: boolean) {
    setError(null);
    try {
      await setUsageBased(enabled);
      setUsageBasedState(enabled);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.toggleFailed);
    }
  }

  /** Anchors the breakdown below the hovered cell, right-aligned to it. */
  function showTokens(target: HTMLElement, tokens: UsageTokens) {
    const rect = target.getBoundingClientRect();
    setHover({ tokens, top: rect.bottom + 6, right: window.innerWidth - rect.right });
  }

  useEffect(() => {
    let cancelled = false;
    fetchSpending()
      .then((next) => {
        if (!cancelled) {
          setData(next);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : t.loadFailed);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <p className="kicker">{t.kicker}</p>
      <h1 className={styles.title}>{t.title}</h1>
      {error ? <p className="notice notice-error">{error}</p> : null}
      <div className="grid grid-2">
        <article className="card">
          <h3>{t.wallet}</h3>
          <p className={styles.stat}>{formatUsdMicros(data?.walletMicros ?? 0)}</p>
          <p className={styles.statSub}>{t.walletHelp}</p>
        </article>
        <article className="card">
          <h3>{t.plan}</h3>
          <p className={styles.stat}>{data?.plan ? planDisplayName(data.plan) : t.noPlan}</p>
          <p className={styles.statSub}>{t.planHelp}</p>
        </article>
      </div>
      <h2 className={styles.sectionTitle}>{t.packs}</h2>
      <div className="btn-row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {PACKS.map((pack) => (
          <button
            key={pack}
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={() => void onTopUp({ kind: 'credits', pack })}
          >
            ${pack}
          </button>
        ))}
        <form
          className={styles.customTopup}
          onSubmit={(event) => {
            event.preventDefault();
            if (customCents !== null) void onTopUp({ kind: 'credits_custom', amount_cents: customCents });
          }}
        >
          <span className={styles.customPrefix}>$</span>
          <input
            type="number"
            inputMode="decimal"
            min={MIN_TOPUP_USD}
            max={MAX_TOPUP_USD}
            step="0.01"
            placeholder={t.custom}
            aria-label={t.customAria}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending || customCents === null}>
            {t.add}
          </button>
        </form>
      </div>
      <p className={styles.statSub}>{t.customRange(MIN_TOPUP_USD, MAX_TOPUP_USD.toLocaleString('en-US'))}</p>
      <article className="card" style={{ marginTop: 24 }}>
        <h3>{t.overage}</h3>
        <p className="muted">{t.overageHelp}</p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onToggle(true)}
            disabled={usageBased === true}
          >
            {t.enable}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void onToggle(false)}
            disabled={usageBased === false}
          >
            {t.disable}
          </button>
        </div>
      </article>
      <h2 className={styles.sectionTitle}>{t.events}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.cols[0]}</th>
              <th>{t.cols[1]}</th>
              <th>{t.cols[2]}</th>
              <th className="num">{t.cols[3]}</th>
              <th className="num">{t.cols[4]}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.events ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  {t.noEvents}
                </td>
              </tr>
            ) : (
              (data?.events ?? []).map((event) => (
                <tr key={event.id}>
                  <td>{event.at ?? '—'}</td>
                  <td>{event.purpose || '—'}</td>
                  <td>{event.source || '—'}</td>
                  <td className="num">
                    {event.tokens ? (
                      <span
                        className={styles.tokenCell}
                        tabIndex={0}
                        onMouseEnter={(mouse) => event.tokens && showTokens(mouse.currentTarget, event.tokens)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={(focus) => event.tokens && showTokens(focus.currentTarget, event.tokens)}
                        onBlur={() => setHover(null)}
                      >
                        {compact.format(event.tokens.total)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="num">
                    {event.billing === 'included' ? (
                      <span className="muted" title={t.includedTitle(formatUsdMicros(event.amountMicros))}>
                        {t.included}
                      </span>
                    ) : (
                      formatUsdMicros(event.amountMicros)
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {hover ? <TokenBreakdown hover={hover} t={t} /> : null}
    </div>
  );
}
