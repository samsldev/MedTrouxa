/**
 * @fileoverview Recapture landing: 50 percent off the first month on every plan.
 * @author Samuel S. L.
 * @version 1.0.0
 * @since 2026-09-25
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
 * - `/lp/offer?lp=<product>-<variant>-<locale>`: reached from the exit-intent modal, the
 *   back button on a landing, or a canceled Stripe Checkout started from a landing
 * - Locale comes from the landing tag, else the browser; every plan shows the struck
 *   regular price and the first-month price, with the conditions in plain words
 * - Each CTA opens `/subscribe` with `offer=intro` (monthly); the backend decides eligibility
 * - "No thanks" goes to /pricing at regular price
 */

import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../../../components/Icons';
import { Reveal } from '../../../components/Reveal';
import layout from '../../../components/PublicLayout.module.css';
import { formatUsd } from '../../../lib/format';
import { listPlans } from '../../../lib/plans';
import home from '../Home.module.css';
import { detectLandingLocale, isLandingLocale } from './copy';
import { OFFER_COPY } from './offerCopy';
import styles from './Landing.module.css';

/** Plan highlighted as the default choice. */
const FEATURED = 'starter';

/**
 * Recapture offer page.
 */
export function OfferPage() {
  const [params] = useSearchParams();
  const tag = params.get('lp') ?? 'offer';
  const suffix = tag.split('-').pop();
  const locale = isLandingLocale(suffix)
    ? suffix
    : detectLandingLocale(typeof navigator === 'undefined' ? [] : navigator.languages ?? []);
  const copy = OFFER_COPY[locale];
  const subscribe = (plan: string) =>
    `/subscribe?plan=${plan}&interval=monthly&offer=intro&lp=${encodeURIComponent(tag)}`;

  useEffect(() => {
    const previous = document.title;
    document.title = copy.title;
    return () => {
      document.title = previous;
    };
  }, [copy]);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={layout.logo}>
            <span className={layout.mark} aria-hidden="true" />
            <span>Faelith</span>
          </span>
          <Link to={subscribe(FEATURED)} className="btn btn-primary btn-sm">
            {copy.claim('Starter')}
          </Link>
        </div>
      </header>

      <main className={home.root}>
        <div className={home.glow} aria-hidden="true" />
        <section className={styles.heroDemo}>
          <div className={styles.heroDemoCopy}>
            <p className={`kicker fade-up ${styles.kicker}`}>
              <span className={styles.liveDot} aria-hidden="true" />
              {copy.kicker}
            </p>
            <h1 className={`${home.headline} ${styles.headline} fade-up`}>
              {copy.headline[0]}
              <span className="serif">{copy.headline[1]}</span>
            </h1>
            <p className="lede fade-up">{copy.lede}</p>
          </div>
        </section>

        <section className={styles.offerGrid}>
          {listPlans().map((plan, index) => (
            <Reveal
              key={plan.id}
              delay={index * 60}
              className={`card ${styles.offerCard} ${plan.id === FEATURED ? styles.offerFeatured : ''}`}
            >
              <span className={styles.offerBadge}>-50%</span>
              <h3>{plan.name}</h3>
              <p className={styles.offerPrice}>
                <s>{formatUsd(plan.monthlyUsd)}</s>
                <strong>{formatUsd(plan.monthlyUsd / 2)}</strong>
                <span>{copy.firstMonth}</span>
              </p>
              <p className={styles.offerThen}>{copy.thenLabel(formatUsd(plan.monthlyUsd))}</p>
              <Link className={`btn ${plan.id === FEATURED ? 'btn-primary' : 'btn-ghost'}`} to={subscribe(plan.id)}>
                {copy.claim(plan.name)}
                <Icon name="arrow" size={14} className="arrow" />
              </Link>
            </Reveal>
          ))}
        </section>

        <section className={styles.offerFine}>
          {copy.guarantee && (
            <p className={styles.guarantee}>
              <Icon name="shield" size={15} />
              {copy.guarantee}
            </p>
          )}
          <p>{copy.finePrint}</p>
          <Link to={`/pricing?lp=${encodeURIComponent(tag)}`} className={styles.noThanks}>
            {copy.noThanks}
          </Link>
        </section>
      </main>
    </div>
  );
}
