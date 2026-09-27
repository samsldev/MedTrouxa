/**
 * @fileoverview Dashboard overview of plan, usage-based flag, and meter snapshot.
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
 * - Loads GET /api/overview
 * - Prompts subscribe when no plan is attached
 * - Renders a year-long activity heatmap (All / Chat / Code) and empty meters without failing the page
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ActivityHeatmap } from '../../components/ActivityHeatmap';
import { ApiError, fetchOverview } from '../../lib/api';
import { meterPercent } from '../../lib/format';
import { useT, type Dict } from '../../lib/i18n';
import { planDisplayName } from '../../lib/plans';
import type { MeterBar, OverviewResponse } from '../../lib/types';
import styles from './Dashboard.module.css';

const EMPTY_METER: MeterBar = { used: 0, limit: 0, remaining: 0, exhausted: false };

interface OverviewStrings {
  exhausted: string;
  remaining: (pct: number) => string;
  loadFailed: string;
  kicker: string;
  title: string;
  plan: string;
  noPlan: string;
  subscribe: string;
  manage: string;
  overage: string;
  enabled: string;
  disabled: string;
  overageHelp: string;
  usageTitle: string;
  fiveHour: string;
  weekly: string;
  activity: string;
}

const T: Dict<OverviewStrings> = {
  en: {
    exhausted: 'Exhausted',
    remaining: (pct) => `${pct}% remaining`,
    loadFailed: 'Unable to load overview',
    kicker: 'Overview',
    title: 'Account',
    plan: 'Plan',
    noPlan: 'No plan',
    subscribe: 'Subscribe',
    manage: 'Manage in Billing & Invoices.',
    overage: 'Usage-based overage',
    enabled: 'Enabled',
    disabled: 'Disabled',
    overageHelp: 'When enabled, overflow debits prepaid credits instead of hard-stopping.',
    usageTitle: 'Usage · 5-hour and weekly',
    fiveHour: 'Code / CLI / Chat · 5-hour',
    weekly: 'Code / CLI / Chat · weekly',
    activity: 'Activity',
  },
  br: {
    exhausted: 'Esgotado',
    remaining: (pct) => `${pct}% restante`,
    loadFailed: 'Não foi possível carregar a visão geral',
    kicker: 'Visão geral',
    title: 'Conta',
    plan: 'Plano',
    noPlan: 'Sem plano',
    subscribe: 'Assinar',
    manage: 'Gerencie em Cobrança e faturas.',
    overage: 'Excedente por uso',
    enabled: 'Ativado',
    disabled: 'Desativado',
    overageHelp: 'Quando ativado, o excedente debita créditos pré-pagos em vez de parar.',
    usageTitle: 'Uso · 5 horas e semanal',
    fiveHour: 'Code / CLI / Chat · 5 horas',
    weekly: 'Code / CLI / Chat · semanal',
    activity: 'Atividade',
  },
  pt: {
    exhausted: 'Esgotado',
    remaining: (pct) => `${pct}% restante`,
    loadFailed: 'Não foi possível carregar a visão geral',
    kicker: 'Visão geral',
    title: 'Conta',
    plan: 'Plano',
    noPlan: 'Sem plano',
    subscribe: 'Subscrever',
    manage: 'Faça a gestão em Faturação e faturas.',
    overage: 'Excedente por utilização',
    enabled: 'Ativado',
    disabled: 'Desativado',
    overageHelp: 'Quando ativado, o excedente debita créditos pré-pagos em vez de parar.',
    usageTitle: 'Utilização · 5 horas e semanal',
    fiveHour: 'Code / CLI / Chat · 5 horas',
    weekly: 'Code / CLI / Chat · semanal',
    activity: 'Atividade',
  },
};

/**
 * Renders one meter as consumed percentage over 100% plus the remaining share.
 */
function PercentCard({ title, bar, t }: { title: string; bar: MeterBar; t: OverviewStrings }) {
  const percent = meterPercent(bar);
  return (
    <article className="card">
      <h3>{title}</h3>
      <p className={styles.stat}>
        {Math.round(percent)}%
        <span className="muted" style={{ fontSize: 16 }}> / 100%</span>
      </p>
      <p className={styles.statSub}>{bar.exhausted ? t.exhausted : t.remaining(Math.round(100 - percent))}</p>
    </article>
  );
}

/**
 * Authenticated overview landing.
 */
export function OverviewPage() {
  const t = useT(T);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOverview()
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

  return (
    <div className={styles.wrap}>
      <p className="kicker">{t.kicker}</p>
      <h1 className={styles.title}>{t.title}</h1>
      {error ? <p className="notice notice-error">{error}</p> : null}
      <div className="grid grid-2">
        <article className="card">
          <h3>{t.plan}</h3>
          <p className={styles.stat}>{data?.plan ? planDisplayName(data.plan) : t.noPlan}</p>
          {!data?.plan ? (
            <div className="btn-row">
              <Link className="btn btn-primary btn-sm" to="/app/billing">
                {t.subscribe}
              </Link>
            </div>
          ) : (
            <p className={styles.statSub}>{t.manage}</p>
          )}
        </article>
        <article className="card">
          <h3>{t.overage}</h3>
          <p>
            <span className={`badge ${data?.usageBased ? 'badge-success' : ''}`}>
              {data?.usageBased ? t.enabled : t.disabled}
            </span>
          </p>
          <p className={styles.statSub}>{t.overageHelp}</p>
        </article>
      </div>
      <h2 className={styles.sectionTitle}>{t.usageTitle}</h2>
      <div className="grid grid-2">
        <PercentCard t={t} title={t.fiveHour} bar={data?.usage?.code5h ?? EMPTY_METER} />
        <PercentCard t={t} title={t.weekly} bar={data?.usage?.codeWeekly ?? EMPTY_METER} />
      </div>
      <h2 className={styles.sectionTitle}>{t.activity}</h2>
      <ActivityHeatmap days={data?.heatmap ?? []} />
    </div>
  );
}
