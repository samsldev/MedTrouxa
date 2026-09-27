/**
 * @fileoverview Billing: plan checkout, credit packs, portal, and usage-based toggle.
 * @author Samuel S. L.
 * @version 1.10.0
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
 * - Starts Stripe checkout for monthly or yearly subscriptions
 * - Yearly interval sends `interval: "yearly"`; the backend maps it to the annual price
 * - Opens the Customer Portal for invoices and payment methods
 * - Lists paid invoices pulled from Stripe with links to the hosted page and PDF
 * - Cancel: full refund inside the statutory refund period, otherwise at the end of the paid period
 * - Brazilian service invoices (NFS-e) and the CPF / CNPJ form live in the FiscalNotes section
 * - Outside the refund period, eligible monthly plans are first offered 50 percent off the next month
 * - Credit packs and usage-based overage live on the Spending page
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntervalToggle } from '../../components/IntervalToggle';
import {
  acceptRetentionOffer,
  ApiError,
  cancelSubscription,
  fetchBilling,
  fetchRetentionOffer, 
  fetchInvoices,
  refundSubscription,
  startCheckout,
  startPortal,
} from '../../lib/api';
import { formatUsd } from '../../lib/format';
import { FiscalNotes } from './FiscalNotes';
import { HTML_LANG, useLocale, type Dict } from '../../lib/i18n';
import { listPlans, planCycleUsd, planDisplayName, planYearlySavingsUsd } from '../../lib/plans';
import type { BillingInterval, BillingResponse, Invoice, PlanId } from '../../lib/types';
import styles from './Dashboard.module.css';

interface BillingStrings {
  invoicesFailed: string;
  confirmRefund: string;
  confirmCancel: string;
  refunded: string;
  cancelled: string;
  cancelFailed: string;
  loadFailed: string;
  checkoutFailed: string;
  portalFailed: string;
  kicker: string;
  title: string;
  currentPlan: string;
  noPlan: string;
  refundUntil: (date: string) => string;
  cancelInfo: string;
  cancelRefund: string;
  cancelSub: string;
  offerKicker: string;
  offerTitle: (price: string, full: string) => string;
  offerBody: string;
  offerAccept: string;
  offerDecline: string;
  offerAccepted: (date: string) => string;
  offerFailed: string;
  subscribe: string;
  current: string;
  suffix: Record<BillingInterval, string>;
  saveYear: (amount: string) => string;
  sameRates: string;
  active: string;
  checkout: string;
  invoices: string;
  invoicesHelp: string;
  cols: [string, string, string, string, string];
  loading: string;
  noInvoices: string;
  view: string;
  portal: string;
}

const T: Dict<BillingStrings> = {
  en: {
    invoicesFailed: 'Unable to load invoices',
    confirmRefund: 'Cancel now and receive a full refund? Your keys stop working immediately.',
    confirmCancel: 'Cancel your subscription? It stays active until the end of the period you already paid for.',
    refunded: 'Subscription cancelled and fully refunded.',
    cancelled: 'Your subscription will end at the close of the current period.',
    cancelFailed: 'Unable to cancel',
    loadFailed: 'Unable to load billing',
    checkoutFailed: 'Checkout failed',
    portalFailed: 'Portal failed',
    kicker: 'Billing & Invoices',
    title: 'Plan and credits',
    currentPlan: 'Current plan',
    noPlan: 'No plan',
    refundUntil: (date) => `Full refund available until ${date}.`,
    cancelInfo: 'Cancelling stops renewal; you keep access until the end of the paid period.',
    cancelRefund: 'Cancel and refund',
    cancelSub: 'Cancel subscription',
    offerKicker: 'Before you go',
    offerTitle: (price, full) => `Stay for ${price} next month instead of ${full}`,
    offerBody:
      'Keep your plan at 50% off for one month. During that month allowances are halved and extra usage is billed at provider cost. Your subscription keeps renewing.',
    offerAccept: 'Keep my plan at 50% off',
    offerDecline: 'No thanks, cancel',
    offerAccepted: (date) => `Done. Your renewal on ${date} is 50% off.`,
    offerFailed: 'Unable to apply the offer',
    subscribe: 'Subscribe',
    current: 'Current',
    suffix: { monthly: ' / mo', yearly: ' / yr' },
    saveYear: (amount) => `Save ${amount} a year`,
    sameRates: 'Same list rates as API prepaid',
    active: 'Active',
    checkout: 'Checkout',
    invoices: 'Invoices',
    invoicesHelp: 'Invoices, payment methods, and tax IDs are managed in the Stripe Customer Portal.',
    cols: ['Date', 'Invoice', 'Description', 'Amount', 'Receipt'],
    loading: 'Loading…',
    noInvoices: 'No paid invoices yet.',
    view: 'View',
    portal: 'Customer Portal',
  },
  br: {
    invoicesFailed: 'Não foi possível carregar as faturas',
    confirmRefund: 'Cancelar agora e receber o reembolso integral? Suas chaves param de funcionar na hora.',
    confirmCancel: 'Cancelar sua assinatura? Ela continua ativa até o fim do período que você já pagou.',
    refunded: 'Assinatura cancelada e reembolsada integralmente.',
    cancelled: 'Sua assinatura vai terminar no fim do período atual.',
    cancelFailed: 'Não foi possível cancelar',
    loadFailed: 'Não foi possível carregar a cobrança',
    checkoutFailed: 'Não foi possível abrir o pagamento',
    portalFailed: 'Não foi possível abrir o portal',
    kicker: 'Cobrança e faturas',
    title: 'Plano e créditos',
    currentPlan: 'Plano atual',
    noPlan: 'Sem plano',
    refundUntil: (date) => `Reembolso integral disponível até ${date}.`,
    cancelInfo: 'Cancelar interrompe a renovação; você mantém o acesso até o fim do período pago.',
    cancelRefund: 'Cancelar e reembolsar',
    cancelSub: 'Cancelar assinatura',
    offerKicker: 'Antes de você ir',
    offerTitle: (price, full) => `Fique pagando ${price} no próximo mês em vez de ${full}`,
    offerBody:
      'Mantenha seu plano com 50% de desconto por um mês. Nesse mês os limites ficam pela metade e o uso extra é cobrado a preço de custo. Sua assinatura continua renovando.',
    offerAccept: 'Manter meu plano com 50% off',
    offerDecline: 'Não, quero cancelar',
    offerAccepted: (date) => `Pronto. Sua renovação em ${date} sai com 50% de desconto.`,
    offerFailed: 'Não foi possível aplicar a oferta',
    subscribe: 'Assinar',
    current: 'Atual',
    suffix: { monthly: ' / mês', yearly: ' / ano' },
    saveYear: (amount) => `Economize ${amount} por ano`,
    sameRates: 'Mesma tabela de preços do pré-pago da API',
    active: 'Ativo',
    checkout: 'Assinar',
    invoices: 'Faturas',
    invoicesHelp: 'Faturas, formas de pagamento e dados fiscais são gerenciados no Portal do Cliente da Stripe.',
    cols: ['Data', 'Fatura', 'Descrição', 'Valor', 'Recibo'],
    loading: 'Carregando…',
    noInvoices: 'Nenhuma fatura paga ainda.',
    view: 'Ver',
    portal: 'Portal do Cliente',
  },
  pt: {
    invoicesFailed: 'Não foi possível carregar as faturas',
    confirmRefund: 'Cancelar agora e receber o reembolso total? As suas chaves deixam de funcionar de imediato.',
    confirmCancel: 'Cancelar a sua subscrição? Mantém-se ativa até ao fim do período que já pagou.',
    refunded: 'Subscrição cancelada e totalmente reembolsada.',
    cancelled: 'A sua subscrição termina no fim do período atual.',
    cancelFailed: 'Não foi possível cancelar',
    loadFailed: 'Não foi possível carregar a faturação',
    checkoutFailed: 'Não foi possível abrir o pagamento',
    portalFailed: 'Não foi possível abrir o portal',
    kicker: 'Faturação e faturas',
    title: 'Plano e créditos',
    currentPlan: 'Plano atual',
    noPlan: 'Sem plano',
    refundUntil: (date) => `Reembolso total disponível até ${date}.`,
    cancelInfo: 'Cancelar interrompe a renovação; mantém o acesso até ao fim do período pago.',
    cancelRefund: 'Cancelar e reembolsar',
    cancelSub: 'Cancelar subscrição',
    offerKicker: 'Antes de sair',
    offerTitle: (price, full) => `Fique a pagar ${price} no próximo mês em vez de ${full}`,
    offerBody:
      'Mantenha o seu plano com 50% de desconto durante um mês. Nesse mês os limites ficam a metade e a utilização extra é cobrada a preço de custo. A sua subscrição continua a renovar.',
    offerAccept: 'Manter o meu plano com 50% de desconto',
    offerDecline: 'Não, quero cancelar',
    offerAccepted: (date) => `Feito. A sua renovação a ${date} tem 50% de desconto.`,
    offerFailed: 'Não foi possível aplicar a oferta',
    subscribe: 'Subscrever',
    current: 'Atual',
    suffix: { monthly: ' / mês', yearly: ' / ano' },
    saveYear: (amount) => `Poupe ${amount} por ano`,
    sameRates: 'Mesma tabela de preços do pré-pago da API',
    active: 'Ativo',
    checkout: 'Subscrever',
    invoices: 'Faturas',
    invoicesHelp: 'Faturas, métodos de pagamento e dados fiscais são geridos no Portal do Cliente da Stripe.',
    cols: ['Data', 'Fatura', 'Descrição', 'Valor', 'Recibo'],
    loading: 'A carregar…',
    noInvoices: 'Ainda não há faturas pagas.',
    view: 'Ver',
    portal: 'Portal do Cliente',
  },
};

/**
 * Redirects the browser to a Stripe-hosted URL returned by the API.
 */
function go(url: string): void {
  window.location.href = url;
}

/**
 * Formats an invoice total from the smallest currency unit.
 */
function formatInvoiceAmount(invoice: Invoice, lang: string): string {
  return new Intl.NumberFormat(lang, { style: 'currency', currency: invoice.currency.toUpperCase() }).format(
    invoice.amountPaid / 100,
  );
}

/**
 * Parses the optional `?interval=` query param carried over from the public pricing page.
 */
function readInterval(raw: string | null): BillingInterval {
  return raw === 'yearly' ? 'yearly' : 'monthly';
}

/**
 * Authenticated billing and invoices page.
 */
export function BillingPage() {
  const { locale } = useLocale();
  const t = T[locale];
  const lang = HTML_LANG[locale];
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<BillingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>(() => readInterval(searchParams.get('interval')));
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [offerRenewsAt, setOfferRenewsAt] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices()
      .then(setInvoices)
      .catch((caught: unknown) => {
        setInvoiceError(caught instanceof ApiError ? caught.message : t.invoicesFailed);
      });
  }, []);

  /**
   * Cancel button handler. Outside the refund period it first asks the API whether the
   * retention offer applies and shows it instead of cancelling; a failed lookup falls
   * through to the normal cancel so the offer can never block cancellation.
   */
  async function onCancel(refund: boolean) {
    if (!refund) {
      setPending(true);
      setError(null);
      const offer = await fetchRetentionOffer().catch(() => null);
      setPending(false);
      if (offer?.eligible && offer.renewsAt) {
        setOfferRenewsAt(offer.renewsAt);
        return;
      }
    }
    await confirmAndCancel(refund);
  }

  /**
   * Accepts the retention offer: Stripe discounts the next renewal and any pending cancel is cleared.
   */
  async function onAcceptOffer() {
    const renewsAt = offerRenewsAt;
    setPending(true);
    setError(null);
    try {
      await acceptRetentionOffer();
      setOfferRenewsAt(null);
      setNotice(t.offerAccepted(renewsAt ? new Date(renewsAt).toLocaleDateString(lang) : ''));
      await reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.offerFailed);
    } finally {
      setPending(false);
    }
  }

  /**
   * Declines the retention offer and continues with the regular cancel confirmation.
   */
  async function onDeclineOffer() {
    setOfferRenewsAt(null);
    await confirmAndCancel(false);
  }

  /**
   * Refund (inside the refund period) or cancel at period end, after confirmation.
   */
  async function confirmAndCancel(refund: boolean) {
    if (!window.confirm(refund ? t.confirmRefund : t.confirmCancel)) return;
    setPending(true);
    setError(null);
    try {
      if (refund) await refundSubscription();
      else await cancelSubscription();
      setNotice(refund ? t.refunded : t.cancelled);
      await reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.cancelFailed);
    } finally {
      setPending(false);
    }
  }

  /**
   * Reloads GET /api/billing into local state.
   */
  async function reload() {
    const next = await fetchBilling();
    setData(next);
  }

  useEffect(() => {
    void reload().catch((caught: unknown) => {
      setError(caught instanceof ApiError ? caught.message : t.loadFailed);
    });
  }, []);

  /**
   * Starts a subscription Checkout session and navigates to the returned URL.
   */
  async function onCheckout(plan: PlanId) {
    setPending(true);
    setError(null);
    try {
      const url = await startCheckout({ kind: 'subscription', plan, interval });
      go(url);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.checkoutFailed);
      setPending(false);
    }
  }

  /**
   * Opens the Stripe Customer Portal for invoices and payment methods.
   */
  async function onPortal() {
    setPending(true);
    setError(null);
    try {
      const url = await startPortal();
      go(url);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.portalFailed);
      setPending(false);
    }
  }

  const currentPlan = listPlans().find((plan) => plan.id === data?.plan);

  return (
    <div className={styles.wrap}>
      <p className="kicker">{t.kicker}</p>
      <h1 className={styles.title}>{t.title}</h1>
      {error ? <p className="notice notice-error">{error}</p> : null}
      <article className="card">
        <h3>{t.currentPlan}</h3>
        <p className={styles.stat}>{data?.plan ? planDisplayName(data.plan) : t.noPlan}</p>
        {notice ? <p className="notice">{notice}</p> : null}
        {data?.plan ? (
          <>
            <p className={styles.statSub}>
              {data.refundUntil ? t.refundUntil(new Date(data.refundUntil).toLocaleString(lang)) : t.cancelInfo}
            </p>
            <div className="btn-row" style={{ marginTop: 12 }}>
              {data.refundUntil ? (
                <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => void onCancel(true)}>
                  {t.cancelRefund}
                </button>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => void onCancel(false)}>
                  {t.cancelSub}
                </button>
              )}
            </div>
            {offerRenewsAt && currentPlan ? (
              <div className="card" role="dialog" aria-labelledby="retention-offer-title" style={{ marginTop: 16 }}>
                <p className="kicker">{t.offerKicker}</p>
                <h3 id="retention-offer-title">
                  {t.offerTitle(formatUsd(currentPlan.monthlyUsd / 2), formatUsd(currentPlan.monthlyUsd))}
                </h3>
                <p className={styles.statSub}>{t.offerBody}</p>
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => void onAcceptOffer()}>
                    {t.offerAccept}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => void onDeclineOffer()}>
                    {t.offerDecline}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </article>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h2 className={styles.sectionTitle}>{t.subscribe}</h2>
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>
      <div className="grid grid-3">
        {listPlans().map((plan) => {
          const current = data?.plan === plan.id;
          return (
            <article key={plan.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ marginBottom: 0 }}>{plan.name}</h3>
                {current ? <span className="badge badge-accent">{t.current}</span> : null}
              </div>
              <p className={styles.stat} style={{ marginTop: 10 }}>
                {formatUsd(planCycleUsd(plan, interval))}
                <span className="muted" style={{ fontSize: 14 }}>{t.suffix[interval]}</span>
              </p>
              <p className={styles.statSub}>
                {interval === 'yearly' ? t.saveYear(formatUsd(planYearlySavingsUsd(plan))) : t.sameRates}
              </p>
              <div className="btn-row" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${current ? 'btn-ghost' : 'btn-primary'}`}
                  disabled={pending || current}
                  onClick={() => void onCheckout(plan.id)}
                >
                  {current ? t.active : t.checkout}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <article className="card" style={{ marginTop: 24 }}>
        <h3>{t.invoices}</h3>
        <p className="muted">{t.invoicesHelp}</p>
        {invoiceError ? <p className="notice notice-error">{invoiceError}</p> : null}
        <div className="table-wrap" style={{ margin: '16px 0' }}>
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
              {invoices === null ? (
                <tr>
                  <td colSpan={5} className="muted">
                    {invoiceError ? '—' : t.loading}
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    {t.noInvoices}
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{new Date(invoice.createdAt).toLocaleDateString(lang)}</td>
                    <td>{invoice.number ?? invoice.id}</td>
                    <td>{invoice.description ?? '—'}</td>
                    <td className="num">{formatInvoiceAmount(invoice, lang)}</td>
                    <td className="num">
                      {invoice.hostedUrl ? (
                        <a href={invoice.hostedUrl} target="_blank" rel="noreferrer noopener">
                          {t.view}
                        </a>
                      ) : null}
                      {invoice.hostedUrl && invoice.pdfUrl ? ' · ' : null}
                      {invoice.pdfUrl ? (
                        <a href={invoice.pdfUrl} target="_blank" rel="noreferrer noopener">
                          PDF
                        </a>
                      ) : null}
                      {!invoice.hostedUrl && !invoice.pdfUrl ? '—' : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => void onPortal()}>
            {t.portal}
          </button>
        </div>
      </article>
      <FiscalNotes />
    </div>
  );
}
