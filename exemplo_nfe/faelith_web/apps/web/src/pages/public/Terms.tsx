/**
 * @fileoverview Public Terms of Service page: legal Markdown with version, effective date and a section rail.
 * @author Samuel S. L.
 * @version 1.1.0
 * @since 2026-09-14
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
 * - Route /terms; body comes from docs/legal.ts so lawyers edit Markdown,
 *   not JSX
 * - Header shows version and effective date; a sticky rail lists the
 *   numbered sections for quick navigation
 * - Renders with the shared DocsMarkdown (anchored headings, router links)
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { extractHeadings } from '../../docs/content';
import styles from '../../docs/Docs.module.css';
import { DocsMarkdown } from '../../docs/DocsMarkdown';
import { TERMS_BODY, TERMS_EFFECTIVE, TERMS_VERSION } from '../../docs/legal';
import { TERMS_BODY_BR } from '../../docs/legal.br';
import { TERMS_BODY_PT } from '../../docs/legal.pt';
import { HTML_LANG, useLocale, type Dict, type Locale } from '../../lib/i18n';

const BODY: Record<Locale, string> = { en: TERMS_BODY, br: TERMS_BODY_BR, pt: TERMS_BODY_PT };

interface TermsStrings {
  docTitle: string;
  kicker: string;
  title: string;
  version: string;
  effective: string;
  sections: string;
}

const T: Dict<TermsStrings> = {
  en: { docTitle: 'Terms of Service - Faelith', kicker: 'Legal', title: 'Terms of Service', version: 'Version', effective: 'Effective', sections: 'Sections' },
  br: { docTitle: 'Termos de Serviço - Faelith', kicker: 'Jurídico', title: 'Termos de Serviço', version: 'Versão', effective: 'Vigência a partir de', sections: 'Seções' },
  pt: { docTitle: 'Termos de Serviço - Faelith', kicker: 'Jurídico', title: 'Termos de Serviço', version: 'Versão', effective: 'Em vigor desde', sections: 'Secções' },
};

/** Formats an ISO date as a long date in the page locale. */
function longDate(iso: string, locale: Locale): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === 'en' ? 'en-GB' : HTML_LANG[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Terms of Service page.
 */
export function TermsPage() {
  const { locale } = useLocale();
  const t = T[locale];
  const body = BODY[locale];
  const location = useLocation();
  const headings = useMemo(() => extractHeadings(body), [body]);

  useEffect(() => {
    document.title = t.docTitle;
  }, [t]);

  useEffect(() => {
    // Deep links: the layout scrolls to top on route change, so re-apply the hash.
    if (!location.hash) return;
    const node = document.getElementById(location.hash.slice(1));
    if (node) window.requestAnimationFrame(() => node.scrollIntoView({ block: 'start' }));
  }, [location.hash]);

  return (
    <div className={`page ${styles.legal}`}>
      <header className={styles.legalHead}>
        <p className="kicker">{t.kicker}</p>
        <h1>{t.title}</h1>
        <div className={styles.legalMeta}>
          <span>
            {t.version} {TERMS_VERSION}
          </span>
          <span>
            {t.effective} {longDate(TERMS_EFFECTIVE, locale)}
          </span>
        </div>
      </header>
      <div className={styles.legalGrid}>
        <article className={styles.article}>
          <DocsMarkdown text={body} />
        </article>
        <aside className={styles.toc} aria-label={t.sections}>
          <h4>{t.sections}</h4>
          {headings.map((heading) => (
            <a key={heading.id} href={`#${heading.id}`}>
              {heading.text}
            </a>
          ))}
        </aside>
      </div>
    </div>
  );
}
