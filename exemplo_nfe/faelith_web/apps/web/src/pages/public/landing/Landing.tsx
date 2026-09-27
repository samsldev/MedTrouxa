/**
 * @fileoverview Campaign landings for ads, organic and video traffic: Code and Chat, 3 variants each, 3 locales.
 * @author Samuel S. L.
 * @version 2.3.0
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
 * - Campaign URL: `/lp/:product` or `/lp/:product/:locale` (product code|chat, locale br|pt|en).
 *   The variant (1|2|3) is drawn at random for the A/B/C test and rendered in place, without
 *   changing the URL; the draw is remembered per visitor so reloads show the same variant
 * - QA URL: `/lp/:product/:variant/:locale` pins one variant
 * - A missing locale is detected from the browser; product defaults to code; the query
 *   string (UTMs, click ids) is always kept
 * - Distraction-free layout: logo and one CTA in the header, no site navigation
 * - Sections come from the variant's order; inline CTAs follow the comparison and pricing
 * - Primary CTAs subscribe to Starter directly (`/subscribe`, straight to Stripe Checkout);
 *   the secondary "Explore plans" CTA opens /pricing. Both carry the original query plus
 *   `lp=<product>-<variant>-<locale>` so each variant's conversion is measurable
 * - Recapture: exit intent (pointer leaving through the top of the window) opens a 50 percent
 *   offer modal once per session; the first Back press on a landing opens `/lp/offer`
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { setPageTag } from '../../../lib/analytics';
import { Icon } from '../../../components/Icons';
import { Reveal } from '../../../components/Reveal';
import { TerminalDemo } from '../../../components/TerminalDemo';
import layout from '../../../components/PublicLayout.module.css';
import home from '../Home.module.css';
import { ChatDemo } from './ChatDemo';
import {
  detectLandingLocale,
  isLandingLocale,
  isLandingProduct,
  isLandingVariant,
  landingCopy,
  type LandingCopy,
  type LandingLocale,
  type LandingProduct,
  type LandingSection,
  type LandingVariant,
} from './copy';
import styles from './Landing.module.css';
import { OFFER_COPY, type OfferCopy } from './offerCopy';

/**
 * Pricing URL that keeps the visitor's query (UTMs, click ids) and tags the landing.
 */
function pricingHref(search: string, tag: string): string {
  const params = new URLSearchParams(search);
  params.set('lp', tag);
  return `/pricing?${params.toString()}`;
}

/**
 * One-click subscribe URL for Starter monthly, keeping the visitor's query.
 */
function subscribeHref(search: string, tag: string): string {
  const params = new URLSearchParams(search);
  params.set('plan', 'starter');
  params.set('interval', 'monthly');
  params.set('lp', tag);
  return `/subscribe?${params.toString()}`;
}

/** Destinations and labels shared by every CTA on a landing. */
interface CtaLinks {
  subscribe: string;
  explore: string;
  exploreLabel: string;
  note: string;
}

/** Session flags so each recapture tactic fires at most once per visit. */
const EXIT_SHOWN_KEY = 'faelith_lp_exit_shown';
const BACK_TRAP_KEY = 'faelith_lp_back_trap';

/** Reads a session flag; storage failures count as "not set". */
function sessionFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Sets a session flag, ignoring storage failures. */
function setSessionFlag(key: string): void {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Private mode: the tactic may fire again, which is harmless.
  }
}

/**
 * Recapture tactics for a landing: returns whether the exit-intent modal is open.
 * - Exit intent: the pointer leaves through the top edge (desktop), once per session.
 * - Back button: one extra history entry is pushed; the first Back press lands on the
 *   recapture offer instead of leaving, once per session.
 */
function useRecapture(offerHref: string): [boolean, () => void] {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    /** Opens the modal when the pointer exits through the top of the viewport. */
    function onLeave(event: MouseEvent) {
      if (event.relatedTarget === null && event.clientY <= 0 && !sessionFlag(EXIT_SHOWN_KEY)) {
        setSessionFlag(EXIT_SHOWN_KEY);
        setOpen(true);
      }
    }
    document.addEventListener('mouseout', onLeave);
    return () => document.removeEventListener('mouseout', onLeave);
  }, []);

  useEffect(() => {
    if (sessionFlag(BACK_TRAP_KEY)) return;
    window.history.pushState({ faelithLpTrap: true }, '', window.location.href);
    /** First Back press: go to the offer instead of leaving the site. */
    function onPop() {
      setSessionFlag(BACK_TRAP_KEY);
      navigate(offerHref, { replace: true });
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [navigate, offerHref]);

  return [open, () => setOpen(false)];
}

/**
 * Exit-intent modal with the 50 percent first-month offer.
 */
function ExitModal({ offer, offerHref, onClose }: { offer: OfferCopy; offerHref: string; onClose: () => void }) {
  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="lp-exit-title" onClick={(event) => event.stopPropagation()}>
        <span className={styles.offerBadge}>-50%</span>
        <h2 id="lp-exit-title">{offer.modalTitle}</h2>
        <p>{offer.modalBody}</p>
        <Link className={`btn btn-primary ${styles.ctaButton}`} to={offerHref}>
          {offer.modalCta}
          <Icon name="arrow" size={16} className="arrow" />
        </Link>
        <button type="button" className="link-button" onClick={onClose}>
          {offer.modalDismiss}
        </button>
      </div>
    </div>
  );
}

const VARIANTS: readonly LandingVariant[] = ['1', '2', '3'];

/**
 * Random variant for the A/B/C test, remembered per visitor and product so a reload
 * (or a second ad click) keeps the same variant. Storage failures fall back to a fresh draw.
 */
function assignedVariant(product: LandingProduct): LandingVariant {
  const key = `faelith_lp_variant_${product}`;
  try {
    const saved = window.localStorage.getItem(key) ?? undefined;
    if (isLandingVariant(saved)) return saved;
  } catch {
    // Private mode or blocked storage: draw without remembering.
  }
  const drawn = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
  try {
    window.localStorage.setItem(key, drawn);
  } catch {
    // Same as above.
  }
  return drawn;
}

/** Browser languages, empty outside a browser. */
function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

/**
 * Serif-accented two-part title.
 */
function Title({ parts }: { parts: [string, string] }) {
  return (
    <>
      {parts[0]}
      <span className="serif">{parts[1]}</span>
    </>
  );
}

/**
 * Primary CTA with the reassurance note underneath.
 */
function Cta({ links, label, center = false }: { links: CtaLinks; label: string; center?: boolean }) {
  return (
    <div className={`${styles.cta} ${center ? styles.ctaCenter : ''}`}>
      <div className={styles.ctaRow}>
        <Link className={`btn btn-primary ${styles.ctaButton}`} to={links.subscribe}>
          {label}
          <Icon name="arrow" size={16} className="arrow" />
        </Link>
        <Link className={`btn btn-ghost ${styles.ctaSecondary}`} to={links.explore}>
          {links.exploreLabel}
        </Link>
      </div>
      <span className={styles.ctaNote}>{links.note}</span>
    </div>
  );
}

/**
 * Renders one body section of the landing.
 */
function Section({ kind, copy, links }: { kind: LandingSection; copy: LandingCopy; links: CtaLinks }): ReactNode {
  switch (kind) {
    case 'pains':
      return (
        <section className={styles.block}>
          <Reveal className="section-head">
            <h2 className="section-title"><Title parts={copy.painsTitle} /></h2>
          </Reveal>
          <div className={styles.pains}>
            {copy.pains.map((pain, index) => (
              <Reveal key={pain.before} delay={index * 80} className={`card ${styles.pain}`}>
                <p className={styles.before}>{pain.before}</p>
                <p className={styles.after}>
                  <Icon name="check" size={16} />
                  {pain.after}
                </p>
              </Reveal>
            ))}
          </div>
        </section>
      );
    case 'compare':
      return (
        <section className={styles.block}>
          <Reveal className="section-head">
            <h2 className="section-title"><Title parts={copy.compareTitle} /></h2>
          </Reveal>
          <Reveal className={styles.compare}>
            <div className={`${styles.compareRow} ${styles.compareHead}`}>
              <span />
              <span className={styles.compareUs}>{copy.compareColumns[0]}</span>
              <span>{copy.compareColumns[1]}</span>
            </div>
            {copy.compareRows.map((row) => (
              <div key={row.label} className={styles.compareRow}>
                <span>{row.label}</span>
                <span className={`${styles.mark} ${styles.yes} ${styles.compareUs}`}>
                  <Icon name="check" size={16} />
                </span>
                <span className={`${styles.mark} ${row.them === true ? styles.yes : row.them === 'partial' ? styles.partial : styles.no}`}>
                  {row.them === true ? <Icon name="check" size={16} /> : row.them === 'partial' ? '~' : <Icon name="close" size={14} />}
                </span>
              </div>
            ))}
          </Reveal>
          <Cta links={links} label={copy.primaryCta} center />
        </section>
      );
    case 'steps':
      return (
        <section className={styles.block} id="how">
          <Reveal className="section-head">
            <h2 className="section-title"><Title parts={copy.stepsTitle} /></h2>
          </Reveal>
          <ol className={styles.steps}>
            {copy.steps.map((step, index) => (
              <Reveal as="li" key={step.title} delay={index * 90} className={styles.step}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </Reveal>
            ))}
          </ol>
          {copy.install && (
            <Reveal className={styles.install}>
              <code className={home.ctaCode}>{copy.install}</code>
            </Reveal>
          )}
        </section>
      );
    case 'features':
      return (
        <section className={styles.block}>
          <Reveal className="section-head">
            <h2 className="section-title"><Title parts={copy.featuresTitle} /></h2>
          </Reveal>
          <div className={styles.features}>
            {copy.features.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 70} className={`card ${styles.feature}`}>
                <span className={styles.featureIcon}>
                  <Icon name={feature.icon} size={18} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </Reveal>
            ))}
          </div>
        </section>
      );
    case 'pricing':
      return (
        <section className={styles.block}>
          <Reveal className="section-head">
            <h2 className="section-title"><Title parts={copy.pricingTitle} /></h2>
          </Reveal>
          <Reveal className={styles.pricing}>
            <div className={styles.pricingGlow} aria-hidden="true" />
            <p className={styles.price}>
              <span className={styles.priceValue}>{copy.pricingFrom}</span>
              <span className={styles.pricePer}>{copy.pricingPer}</span>
            </p>
            <ul className={styles.pricingPoints}>
              {copy.pricingPoints.map((point) => (
                <li key={point}>
                  <Icon name="check" size={15} />
                  {point}
                </li>
              ))}
            </ul>
            <Cta links={links} label={copy.primaryCta} center />
          </Reveal>
        </section>
      );
    case 'faq':
      return (
        <section className={styles.block}>
          <Reveal className="section-head">
            <h2 className="section-title">{copy.faqTitle}</h2>
          </Reveal>
          <div className={styles.faq}>
            {copy.faq.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary>
                  {item.q}
                  <Icon name="arrow" size={14} className={styles.faqCaret} />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
  }
}

/**
 * `/lp/*`: resolves product, locale, and the (random or pinned) variant, then renders.
 */
export function LandingPage() {
  const params = useParams();
  const { search } = useLocation();

  // `/lp/<locale>` (no product) is a Code landing in that locale.
  const product: LandingProduct | undefined = isLandingLocale(params.product)
    ? 'code'
    : isLandingProduct(params.product)
      ? params.product
      : undefined;
  // The second segment is a pinned variant (QA) or, on campaign URLs, the locale.
  const pinned = isLandingVariant(params.variant) ? params.variant : undefined;
  const localeSegment = isLandingLocale(params.product)
    ? params.product
    : pinned
      ? params.locale
      : params.variant;
  const randomVariant = useMemo(() => assignedVariant(product ?? 'code'), [product]);

  if (!product) {
    return <Navigate to={`/lp/code${search}`} replace />;
  }
  if (localeSegment !== undefined && !isLandingLocale(localeSegment)) {
    return <Navigate to={`/lp/${product}${search}`} replace />;
  }
  const locale = localeSegment ?? detectLandingLocale(browserLanguages());
  const variant = pinned ?? randomVariant;
  return <LandingView copy={landingCopy(product, variant, locale)} locale={locale} tag={`${product}-${variant}-${locale}`} />;
}

/**
 * The page itself for one resolved product, variant and locale.
 */
function LandingView({ copy, locale, tag }: { copy: LandingCopy; locale: LandingLocale; tag: string }) {
  const { search } = useLocation();
  const offer = OFFER_COPY[locale];
  const links: CtaLinks = {
    subscribe: subscribeHref(search, tag),
    explore: pricingHref(search, tag),
    exploreLabel: offer.explorePlans,
    note: offer.subscribeNote,
  };
  const offerHref = `/lp/offer?lp=${encodeURIComponent(tag)}`;
  const [exitOpen, closeExit] = useRecapture(offerHref);
  const { pathname } = useLocation();

  // Random `/lp` visits are reported under the pinned variant URL, which the heatmap can render.
  useEffect(() => setPageTag(pathname, tag, `/lp/${tag.split('-').join('/')}`), [pathname, tag]);

  useEffect(() => {
    const previousTitle = document.title;
    const previousLang = document.documentElement.lang;
    document.title = copy.title;
    document.documentElement.lang = copy.htmlLang;
    return () => {
      document.title = previousTitle;
      document.documentElement.lang = previousLang;
    };
  }, [copy]);

  const demo = copy.chatDemo ? <ChatDemo script={copy.chatDemo} /> : <TerminalDemo />;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to={links.explore} className={layout.logo} aria-label="Faelith">
            <span className={layout.mark} aria-hidden="true" />
            <span>Faelith</span>
          </Link>
          <Link to={links.subscribe} className="btn btn-primary btn-sm">
            {copy.headerCta}
          </Link>
        </div>
      </header>

      <main className={home.root}>
        <div className={home.glow} aria-hidden="true" />
        <div className={home.gridBg} aria-hidden="true" />

        <section className={copy.hero === 'split' ? `${home.hero} ${styles.hero}` : styles.heroDemo}>
          <div className={copy.hero === 'split' ? home.heroCopy : styles.heroDemoCopy}>
            <p className={`kicker fade-up ${styles.kicker}`}>
              <span className={styles.liveDot} aria-hidden="true" />
              {copy.kicker}
            </p>
            <h1 className={`${home.headline} ${styles.headline} fade-up`} style={{ ['--delay' as string]: '80ms' }}>
              <Title parts={copy.headline} />
            </h1>
            <p className="lede fade-up" style={{ ['--delay' as string]: '160ms' }}>
              {copy.lede}
            </p>
            <div className="fade-up" style={{ ['--delay' as string]: '240ms' }}>
              <Cta links={links} label={copy.primaryCta} center={copy.hero === 'demo'} />
            </div>
            {copy.guarantee && (
              <p className={`${styles.guarantee} fade-up`} style={{ ['--delay' as string]: '300ms' }}>
                <Icon name="shield" size={15} />
                {copy.guarantee}
              </p>
            )}
            <div className={`${home.heroMeta} ${copy.hero === 'demo' ? styles.centerRow : ''} fade-up`} style={{ ['--delay' as string]: '340ms' }}>
              {copy.badges.map((badge, index) => (
                <span key={badge} className={index === copy.badges.length - 1 ? 'badge badge-accent' : 'badge'}>
                  {badge}
                </span>
              ))}
            </div>
          </div>
          <div className={`${copy.hero === 'split' ? home.heroVisual : styles.heroDemoVisual} fade-up`} style={{ ['--delay' as string]: '200ms' }}>
            {demo}
            <div className={home.orbit} aria-hidden="true" />
          </div>
        </section>

        {copy.sections.map((kind) => (
          <Section key={kind} kind={kind} copy={copy} links={links} />
        ))}

        <section className={home.section}>
          <Reveal className={home.ctaBand}>
            <div className={home.ctaGlow} aria-hidden="true" />
            <h2 className={home.ctaTitle}><Title parts={copy.finalTitle} /></h2>
            <p className="lede" style={{ textAlign: 'center', fontSize: 15 }}>
              {copy.finalLede}
            </p>
            <Cta links={links} label={copy.primaryCta} center />
          </Reveal>
        </section>
      </main>

      {exitOpen && <ExitModal offer={offer} offerHref={offerHref} onClose={closeExit} />}

      <div className={styles.sticky}>
        <Link className="btn btn-primary" to={links.subscribe}>
          {copy.stickyCta}
          <Icon name="arrow" size={16} className="arrow" />
        </Link>
      </div>
    </div>
  );
}
