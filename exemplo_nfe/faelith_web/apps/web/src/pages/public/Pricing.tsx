/**
 * @fileoverview Public pricing page with monthly/yearly toggle, plan cards, and billing rules.
 * @author Samuel S. L.
 * @version 2.7.0
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
 * - Yearly interval shows effective monthly price, annual total, and dollars saved
 * - Featured Pro plan with accent CTA; other tiers ghost
 * - Checklist features stay qualitative: generous usage sized to the plan, not dollar meters
 * - Selected interval is carried to Billing through the query string for logged-in users
 * - Bottom cards restate the three billing rules in plain, confident language
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icons';
import { IntervalToggle } from '../../components/IntervalToggle';
import { Reveal } from '../../components/Reveal';
import { useAuth } from '../../lib/AuthContext';
import { formatUsd } from '../../lib/format';
import { useT, type Dict } from '../../lib/i18n';
import {
  listPlans,
  planCycleUsd,
  planEffectiveMonthlyUsd,
  planYearlySavingsUsd,
  type PlanCatalogEntry,
} from '../../lib/plans';
import type { BillingInterval, PlanId } from '../../lib/types';
import styles from './Marketing.module.css';

const FEATURED: PlanId = 'pro';

interface PricingStrings {
  kicker: string;
  title: [string, string, string];
  lede: string;
  taglines: Record<PlanId, string>;
  features: string[];
  perMonth: string;
  monthlyNote: string;
  yearlyNote: (total: string, saved: string) => string;
  startPro: string;
  choose: (plan: string) => string;
  notes: { badge: string; title: string; body: string }[];
}

const T: Dict<PricingStrings> = {
  en: {
    kicker: 'Pricing',
    title: ['Pay for ', 'capability,', ' not for patience.'],
    lede: 'There is no free plan and no throttled tier. Every plan is the full product with a generous allowance, and the only thing that changes as you go up is how much of it you get. Pay yearly and every tier is 20 percent less.',
    taglines: {
      starter: 'For the engineer who wants to see what changes.',
      pro: 'For daily shipping. The plan most people land on.',
      max: 'For the lead who reviews more than they write.',
      ultra: 'For power users who keep an agent running from first commit to last deploy.',
      scale: 'Enterprise-grade headroom, without the enterprise contract.',
    },
    features: [
      'Generous Code/CLI usage, sized to this plan',
      'Chat shares the Code/CLI 5-hour and weekly pool',
      'One rate card for every API key',
      'Echo and Horizon, 256k and 1M context, from the same pool',
      'Overage from prepaid credits, only if you say so',
    ],
    perMonth: '/ month',
    monthlyNote: 'Billed monthly. Cancel anytime.',
    yearlyNote: (total, saved) => `${total} billed once a year. You keep ${saved} versus monthly.`,
    startPro: 'Start with Pro',
    choose: (plan) => `Choose ${plan}`,
    notes: [
      { badge: 'Code / CLI', title: 'One bucket. Switch freely.', body: 'Editor and terminal share one generous allowance, sized to the plan you pay for. Start a refactor in the IDE, finish it over SSH, and the meter does not care.' },
      { badge: 'Chat', title: 'Thinking is not billed as shipping.', body: 'Chat has its own generous allowance, independent of Code/CLI and also sized to the plan. A long architecture conversation never costs you a fix.' },
      { badge: 'Overage', title: 'Prepaid. Opt-in. Yours.', body: 'When allowance runs out you choose: hard-stop, or spend credits you already bought. API keys always use credits, so production is a number you set.' },
    ],
  },
  br: {
    kicker: 'Preços',
    title: ['Pague pela ', 'capacidade,', ' não pela paciência.'],
    lede: 'Não existe plano grátis nem plano com velocidade limitada. Todo plano é o produto completo com um limite generoso, e a única coisa que muda conforme você sobe é quanto dele você tem. Pague anual e todo plano sai 20% mais barato.',
    taglines: {
      starter: 'Para o engenheiro que quer ver o que muda.',
      pro: 'Para entregar todo dia. O plano em que a maioria fica.',
      max: 'Para o líder que revisa mais do que escreve.',
      ultra: 'Para quem mantém um agente rodando do primeiro commit ao último deploy.',
      scale: 'Folga de nível enterprise, sem o contrato enterprise.',
    },
    features: [
      'Uso generoso de Code/CLI, proporcional ao plano',
      'O Chat compartilha o limite de 5 horas e semanal do Code/CLI',
      'Uma tabela de preços para toda chave de API',
      'Echo e Horizon, contexto de 256k e 1M, do mesmo limite',
      'Excedente com créditos pré-pagos, só se você autorizar',
    ],
    perMonth: '/ mês',
    monthlyNote: 'Cobrança mensal. Cancele quando quiser.',
    yearlyNote: (total, saved) => `${total} cobrados uma vez por ano. Você economiza ${saved} em relação ao mensal.`,
    startPro: 'Começar com o Pro',
    choose: (plan) => `Escolher o ${plan}`,
    notes: [
      { badge: 'Code / CLI', title: 'Um limite só. Troque à vontade.', body: 'Editor e terminal compartilham um limite generoso, proporcional ao plano que você paga. Comece uma refatoração na IDE, termine por SSH, e o medidor nem liga.' },
      { badge: 'Chat', title: 'Pensar não é cobrado como entregar.', body: 'O Chat tem o próprio limite generoso, independente do Code/CLI e também proporcional ao plano. Uma conversa longa de arquitetura nunca custa uma correção.' },
      { badge: 'Excedente', title: 'Pré-pago. Opcional. Seu.', body: 'Quando o limite acaba, você escolhe: parar, ou usar créditos que já comprou. Chaves de API sempre usam créditos, então produção é um número que você define.' },
    ],
  },
  pt: {
    kicker: 'Preços',
    title: ['Pague pela ', 'capacidade,', ' não pela paciência.'],
    lede: 'Não há plano gratuito nem plano com velocidade limitada. Todos os planos são o produto completo com um limite generoso, e a única coisa que muda à medida que sobe é quanto dele tem. Pague anualmente e todos os planos ficam 20% mais baratos.',
    taglines: {
      starter: 'Para o engenheiro que quer ver o que muda.',
      pro: 'Para entregar todos os dias. O plano onde a maioria fica.',
      max: 'Para o líder que revê mais do que escreve.',
      ultra: 'Para quem mantém um agente a trabalhar do primeiro commit ao último deploy.',
      scale: 'Margem de nível enterprise, sem o contrato enterprise.',
    },
    features: [
      'Utilização generosa de Code/CLI, proporcional ao plano',
      'O Chat partilha o limite de 5 horas e semanal do Code/CLI',
      'Uma tabela de preços para todas as chaves de API',
      'Echo e Horizon, contexto de 256k e 1M, do mesmo limite',
      'Excedente com créditos pré-pagos, apenas se autorizar',
    ],
    perMonth: '/ mês',
    monthlyNote: 'Faturação mensal. Cancele quando quiser.',
    yearlyNote: (total, saved) => `${total} faturados uma vez por ano. Poupa ${saved} face ao mensal.`,
    startPro: 'Começar com o Pro',
    choose: (plan) => `Escolher o ${plan}`,
    notes: [
      { badge: 'Code / CLI', title: 'Um só limite. Troque à vontade.', body: 'Editor e terminal partilham um limite generoso, proporcional ao plano que paga. Comece uma refatoração no IDE, termine-a por SSH, e o medidor não se importa.' },
      { badge: 'Chat', title: 'Pensar não é cobrado como entregar.', body: 'O Chat tem o seu próprio limite generoso, independente do Code/CLI e também proporcional ao plano. Uma conversa longa de arquitetura nunca lhe custa uma correção.' },
      { badge: 'Excedente', title: 'Pré-pago. Opcional. Seu.', body: 'Quando o limite acaba, escolhe: parar, ou usar créditos que já comprou. As chaves de API usam sempre créditos, por isso a produção é um número que define.' },
    ],
  },
};

const NOTE_ICONS = ['code', 'chat', 'wallet'] as const;

/**
 * Renders the secondary price line under the headline figure for the selected interval.
 */
function priceNote(t: PricingStrings, plan: PlanCatalogEntry, interval: BillingInterval): string {
  switch (interval) {
    case 'monthly':
      return t.monthlyNote;
    case 'yearly':
      return t.yearlyNote(formatUsd(planCycleUsd(plan, interval)), formatUsd(planYearlySavingsUsd(plan)));
    default: {
      const _never: never = interval;
      return _never;
    }
  }
}

/**
 * Public pricing page with plan cards and subscribe targets.
 */
export function PricingPage() {
  const t = useT(T);
  const { user } = useAuth();
  const [interval, setInterval] = useState<BillingInterval>('yearly');
  const ctaTo = user ? `/app/billing?interval=${interval}` : '/login';

  return (
    <div className="page">
      <header className={styles.pageHero}>
        <p className="kicker fade-up">{t.kicker}</p>
        <h1 className={`${styles.title} fade-up`} style={{ ['--delay' as string]: '80ms' }}>
          {t.title[0]}<span className="serif">{t.title[1]}</span>{t.title[2]}
        </h1>
        <p className="lede fade-up" style={{ ['--delay' as string]: '160ms' }}>
          {t.lede}
        </p>
        <div className="fade-up" style={{ ['--delay' as string]: '240ms', marginTop: 28 }}>
          <IntervalToggle value={interval} onChange={setInterval} />
        </div>
      </header>

      <div className={styles.pricingGrid}>
        {listPlans().map((plan, index) => {
          const featured = plan.id === FEATURED;
          return (
            <Reveal
              key={plan.id}
              delay={index * 60}
              className={`card ${styles.plan} ${featured ? styles.planFeatured : ''}`}
            >
              <span className={styles.planName}>{plan.name}</span>
              <span className={styles.planTagline}>{t.taglines[plan.id]}</span>
              <span className={styles.price}>
                {formatUsd(planEffectiveMonthlyUsd(plan, interval))}
                <small>{t.perMonth}</small>
              </span>
              <span className={styles.priceNote}>{priceNote(t, plan, interval)}</span>
              <ul className={styles.planList}>
                {t.features.map((feature) => (
                  <li key={feature}>
                    <Icon name="check" size={13} />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                className={`btn ${featured ? 'btn-accent' : 'btn-ghost'} ${styles.planCta}`}
                to={ctaTo}
                data-track={`subscribe:${plan.id}:${interval}`}
              >
                {featured ? t.startPro : t.choose(plan.name)}
              </Link>
            </Reveal>
          );
        })}
      </div>

      <div className={styles.pricingNotes}>
        {t.notes.map((note, index) => (
          <Reveal key={note.badge} delay={index * 80} className="card">
            <span className={index === 2 ? 'badge badge-accent' : 'badge'}>
              <Icon name={NOTE_ICONS[index]} size={12} />
              {note.badge}
            </span>
            <h3 style={{ marginTop: 14 }}>{note.title}</h3>
            <p>{note.body}</p>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
