/**
 * @fileoverview Public Changelog: release timeline with product filter and kind badges.
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
 * - Route /changelog; releases come from docs/changelog.ts, newest first
 * - Product chips filter releases that touch a product; "All" resets. The
 *   selection lives in the URL (?product=) so it can be shared
 * - Each release is anchored by version (#2026.09.14) for permalinks
 * - Items render as Markdown fragments with a kind badge (Added, Changed,
 *   Fixed, Security)
 * - Localized (en, pt-BR, pt-PT): release text from changelog.i18n, chrome from `T`
 */
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HTML_LANG, useLocale, type Dict, type Locale } from '../lib/i18n';
import { PRODUCTS, type ChangeKind, type Product } from './changelog';
import { releasesFor } from './changelog.i18n';

interface ChangelogStrings {
  kinds: Record<ChangeKind, string>;
  docTitle: string;
  title: string;
  summary: string;
  filter: string;
  all: string;
  empty: string;
}

const T: Dict<ChangelogStrings> = {
  en: {
    kinds: { added: 'Added', changed: 'Changed', fixed: 'Fixed', security: 'Security' },
    docTitle: 'Changelog - Faelith',
    title: 'What shipped',
    summary: 'Every release for the app, CLI, Chat, Code, API and this website. Newest first.',
    filter: 'Filter by product',
    all: 'All',
    empty: 'No releases for this product yet.',
  },
  br: {
    kinds: { added: 'Novo', changed: 'Alterado', fixed: 'Corrigido', security: 'Segurança' },
    docTitle: 'Changelog - Faelith',
    title: 'O que foi lançado',
    summary: 'Todas as versões do app, CLI, Chat, Code, API e deste site. As mais recentes primeiro.',
    filter: 'Filtrar por produto',
    all: 'Todos',
    empty: 'Ainda não há versões deste produto.',
  },
  pt: {
    kinds: { added: 'Novo', changed: 'Alterado', fixed: 'Corrigido', security: 'Segurança' },
    docTitle: 'Changelog - Faelith',
    title: 'O que foi lançado',
    summary: 'Todas as versões da aplicação, CLI, Chat, Code, API e deste site. As mais recentes primeiro.',
    filter: 'Filtrar por produto',
    all: 'Todos',
    empty: 'Ainda não há versões deste produto.',
  },
};
import styles from './Docs.module.css';
import { DocsMarkdown } from './DocsMarkdown';

/** Formats an ISO date as "14 Sep 2026" in the page locale. */
function formatDate(iso: string, locale: Locale): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString(locale === 'en' ? 'en-GB' : HTML_LANG[locale], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Narrows the ?product= query to a known product, else null (All). */
function parseProduct(value: string | null): Product | null {
  return PRODUCTS.find((product) => product === value) ?? null;
}

/**
 * Changelog page: filter chips and the release timeline.
 */
export function ChangelogPage() {
  const { locale } = useLocale();
  const t = T[locale];
  const [params, setParams] = useSearchParams();
  const selected = parseProduct(params.get('product'));
  const releases = useMemo(() => {
    const all = releasesFor(locale);
    return selected ? all.filter((release) => release.products.includes(selected)) : all;
  }, [selected, locale]);

  useEffect(() => {
    document.title = t.docTitle;
  }, [t]);

  /** Updates the URL filter; null clears it. */
  function select(product: Product | null) {
    const next = new URLSearchParams(params);
    if (product) next.set('product', product);
    else next.delete('product');
    setParams(next, { replace: true });
  }

  return (
    <div className={`page ${styles.changelog}`}>
      <header className={styles.changelogHead}>
        <p className="kicker">Changelog</p>
        <h1>{t.title}</h1>
        <p className={styles.summary}>{t.summary}</p>
        <div className={styles.chips} role="group" aria-label={t.filter}>
          <button type="button" className={selected === null ? styles.chipActive : styles.chip} onClick={() => select(null)}>
            {t.all}
          </button>
          {PRODUCTS.map((product) => (
            <button key={product} type="button" className={selected === product ? styles.chipActive : styles.chip} onClick={() => select(product)}>
              {product}
            </button>
          ))}
        </div>
      </header>

      <ol className={styles.timeline}>
        {releases.map((release) => (
          <li key={release.version} id={release.version} className={styles.release}>
            <div className={styles.releaseMeta}>
              <a href={`#${release.version}`} className={styles.version}>
                {release.version}
              </a>
              <time dateTime={release.date}>{formatDate(release.date, locale)}</time>
              <div className={styles.products}>
                {release.products.map((product) => (
                  <span key={product}>{product}</span>
                ))}
              </div>
            </div>
            <div className={styles.releaseBody}>
              <h2>{release.title}</h2>
              <ul className={styles.changes}>
                {release.items.map((item, index) => (
                  <li key={index} className={styles.change}>
                    <span className={`${styles.badge} ${styles[`badge_${item.kind}`]}`}>{t.kinds[item.kind]}</span>
                    <DocsMarkdown text={item.text} />
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
        {releases.length === 0 && <li className={styles.empty}>{t.empty}</li>}
      </ol>
    </div>
  );
}
