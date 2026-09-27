/**
 * @fileoverview Usage meters for Code/CLI and Chat included allowances.
 * @author Samuel S. L.
 * @version 1.8.0
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
 * - Loads GET /api/usage
 * - Renders the shared Code/CLI/Chat 5h/weekly pool
 * - Subscribers can redeem an admin-granted usage reset within 15 days
 * - Treats missing meters as empty rather than failing the page
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, fetchUsage, redeemUsageReset } from '../../lib/api';
import { meterPercent } from '../../lib/format';
import { useT, type Dict } from '../../lib/i18n';
import type { MeterBar, UsageResponse } from '../../lib/types';
import styles from './Dashboard.module.css';

interface UsageStrings {
  exhausted: string;
  remaining: (pct: number) => string;
  loadFailed: string;
  redeemFailed: string;
  kicker: string;
  title: string;
  subscribersOnly: string;
  subscribeLink: string;
  resetAvailable: string;
  resetHelp: string;
  redeeming: string;
  redeem: string;
  bucket: string;
  fiveHour: string;
  weekly: string;
}

const T: Dict<UsageStrings> = {
  en: {
    exhausted: 'Exhausted',
    remaining: (pct) => `${pct}% remaining`,
    loadFailed: 'Unable to load usage',
    redeemFailed: 'Unable to redeem usage reset',
    kicker: 'Usage',
    title: 'Included allowance',
    subscribersOnly: 'Usage resets are for subscribers.',
    subscribeLink: 'Subscribe in Billing',
    resetAvailable: 'Usage reset available',
    resetHelp: 'Redeeming zeros the shared 5-hour and weekly windows. Use it within 15 days of issue. The clocks restart from now.',
    redeeming: 'Redeeming…',
    redeem: 'Redeem reset',
    bucket: 'Code / CLI / Chat · shared bucket',
    fiveHour: '5-hour',
    weekly: 'Weekly',
  },
  br: {
    exhausted: 'Esgotado',
    remaining: (pct) => `${pct}% restante`,
    loadFailed: 'Não foi possível carregar o uso',
    redeemFailed: 'Não foi possível resgatar o reset de uso',
    kicker: 'Uso',
    title: 'Limite incluído',
    subscribersOnly: 'Resets de uso são para assinantes.',
    subscribeLink: 'Assine em Cobrança',
    resetAvailable: 'Reset de uso disponível',
    resetHelp: 'Resgatar zera as janelas compartilhadas de 5 horas e semanal. Use em até 15 dias após a emissão. Os relógios recomeçam a partir de agora.',
    redeeming: 'Resgatando…',
    redeem: 'Resgatar reset',
    bucket: 'Code / CLI / Chat · limite compartilhado',
    fiveHour: '5 horas',
    weekly: 'Semanal',
  },
  pt: {
    exhausted: 'Esgotado',
    remaining: (pct) => `${pct}% restante`,
    loadFailed: 'Não foi possível carregar a utilização',
    redeemFailed: 'Não foi possível resgatar a reposição de utilização',
    kicker: 'Utilização',
    title: 'Limite incluído',
    subscribersOnly: 'As reposições de utilização são para subscritores.',
    subscribeLink: 'Subscreva em Faturação',
    resetAvailable: 'Reposição de utilização disponível',
    resetHelp: 'Resgatar põe a zero as janelas partilhadas de 5 horas e semanal. Use-a no prazo de 15 dias após a emissão. Os relógios recomeçam a partir de agora.',
    redeeming: 'A resgatar…',
    redeem: 'Resgatar reposição',
    bucket: 'Code / CLI / Chat · limite partilhado',
    fiveHour: '5 horas',
    weekly: 'Semanal',
  },
};

/**
 * Renders one labeled usage bar from a meter snapshot.
 */
function MeterCard({ title, bar, t }: { title: string; bar: MeterBar; t: UsageStrings }) {
  const percent = meterPercent(bar);
  return (
    <article className="card">
      <h3>{title}</h3>
      <p className={styles.stat}>
        {Math.round(percent)}%
        <span className="muted" style={{ fontSize: 15 }}> / 100%</span>
      </p>
      <p className={styles.statSub}>{bar.exhausted ? t.exhausted : t.remaining(Math.round(100 - percent))}</p>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </article>
  );
}

/**
 * Authenticated usage page.
 */
export function UsagePage() {
  const t = useT(T);
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchUsage()
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
    // Loads once; the fallback message uses the locale active at load time.
  }, []);

  const empty: MeterBar = { used: 0, limit: 0, remaining: 0, exhausted: false };
  const isSubscriber = data?.plan != null;
  const available = data?.availableResets ?? 0;

  /**
   * Redeems the oldest usage reset grant and refreshes the meters.
   */
  async function onRedeem() {
    setPending(true);
    setError(null);
    try {
      const next = await redeemUsageReset();
      setData(next);
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? caught.message : t.redeemFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <p className="kicker">{t.kicker}</p>
      <h1 className={styles.title}>{t.title}</h1>
      {error ? <p className="notice notice-error">{error}</p> : null}
      {!isSubscriber ? (
        <p className={styles.statSub}>
          {t.subscribersOnly} <Link to="/app/billing">{t.subscribeLink}</Link>
        </p>
      ) : null}
      {isSubscriber && available > 0 ? (
        <article className="card">
          <h3>{t.resetAvailable}</h3>
          <p className={styles.stat}>{available}</p>
          <p className={styles.statSub}>{t.resetHelp}</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => void onRedeem()}>
              {pending ? t.redeeming : t.redeem}
            </button>
          </div>
        </article>
      ) : null}
      <h2 className={styles.sectionTitle}>{t.bucket}</h2>
      <div className="grid grid-2">
        <MeterCard t={t} title={t.fiveHour} bar={data?.code5h ?? empty} />
        <MeterCard t={t} title={t.weekly} bar={data?.codeWeekly ?? empty} />
      </div>
    </div>
  );
}
