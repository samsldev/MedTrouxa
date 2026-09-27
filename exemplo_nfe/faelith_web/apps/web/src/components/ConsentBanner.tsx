/**
 * @fileoverview Analytics consent banner (LGPD / GDPR) shown until the visitor accepts or declines.
 * @author Samuel S. L.
 * @version 1.0.0
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
 * - Declining keeps only anonymous, aggregate page metrics (no identifiers stored or sent)
 * - Accepting enables per-visitor analytics (random visitor id); the choice is revocable from the footer link
 * - Hidden inside the dashboard and inside frames (admin heatmap overlay)
 * - Localized (en, pt-BR, pt-PT)
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { onConsentChange, readConsent, writeConsent, type Consent } from '../lib/analytics';
import { useT, type Dict } from '../lib/i18n';
import styles from './ConsentBanner.module.css';

interface BannerStrings {
  title: string;
  body: string;
  accept: string;
  decline: string;
}

const T: Dict<BannerStrings> = {
  en: {
    title: 'Analytics cookies',
    body: 'We measure how our pages are used (visits, scroll, clicks) to improve them. Without your consent we only count anonymous totals. With it, we also link your visits with a random identifier. We never sell this data.',
    accept: 'Accept',
    decline: 'Only anonymous',
  },
  br: {
    title: 'Cookies de análise',
    body: 'Medimos como nossas páginas são usadas (visitas, rolagem, cliques) para melhorá-las. Sem o seu consentimento, contamos apenas totais anônimos. Com ele, também ligamos suas visitas por um identificador aleatório. Nunca vendemos esses dados.',
    accept: 'Aceitar',
    decline: 'Apenas anônimo',
  },
  pt: {
    title: 'Cookies de análise',
    body: 'Medimos a forma como as nossas páginas são utilizadas (visitas, deslocamento, cliques) para as melhorar. Sem o seu consentimento, contamos apenas totais anónimos. Com ele, associamos também as suas visitas através de um identificador aleatório. Nunca vendemos estes dados.',
    accept: 'Aceitar',
    decline: 'Apenas anónimo',
  },
};

/**
 * Bottom banner asking for analytics consent; renders nothing once answered.
 */
export function ConsentBanner() {
  const t = useT(T);
  const { pathname } = useLocation();
  const [consent, setConsent] = useState<Consent>(() => readConsent());

  useEffect(() => onConsentChange(() => setConsent(readConsent())), []);

  const framed = window.self !== window.top;
  if (consent !== null || framed || /^\/(app|cli)(\/|$)/.test(pathname)) return null;

  return (
    <div className={styles.banner} role="dialog" aria-labelledby="consent-title" aria-live="polite">
      <div className={styles.text}>
        <strong id="consent-title">{t.title}</strong>
        <p>{t.body}</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => writeConsent('denied')}>
          {t.decline}
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => writeConsent('granted')}>
          {t.accept}
        </button>
      </div>
    </div>
  );
}
