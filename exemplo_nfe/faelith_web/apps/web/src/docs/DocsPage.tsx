/**
 * @fileoverview Public Docs: grouped sidebar, Markdown article, "On this page" rail with scroll-spy, prev/next.
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
 * - Route /docs and /docs/:slug; unknown slugs render a not-found article
 *   with links back, never a redirect away from the docs
 * - Left rail: groups from DOC_GROUPS with a client-side filter box; the
 *   active page is highlighted and scrolled into view on mobile via <details>
 * - Right rail: `##` headings of the current page; IntersectionObserver marks
 *   the section in view. Hash in the URL scrolls to the heading on load
 * - Footer: previous / next in reading order plus "Edit on GitHub"-style
 *   feedback link to Contact
 * - Localized (en, pt-BR, pt-PT): page content from docPagesFor, chrome from `T`
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Icon } from '../components/Icons';
import { useLocale, type Dict, type Locale } from '../lib/i18n';
import { DOC_GROUPS, docGroupLabel, docPagesFor, extractHeadings, findDoc, type DocPage } from './content';

interface DocsStrings {
  nav: string;
  filter: string;
  noMatch: string;
  notFound: string;
  notFoundBody: [string, string];
  back: string;
  docTitle: (page: string) => string;
  documentation: string;
  previous: string;
  next: string;
  feedback: [string, string, string];
  onThisPage: string;
}

const T: Dict<DocsStrings> = {
  en: {
    nav: 'Documentation',
    filter: 'Filter pages',
    noMatch: 'No page matches.',
    notFound: 'Page not found',
    notFoundBody: ['There is no documentation page at', 'It may have moved; the sidebar lists every current page.'],
    back: 'Back to the overview',
    docTitle: (page) => `${page} - Faelith Docs`,
    documentation: 'Documentation',
    previous: 'Previous',
    next: 'Next',
    feedback: ['Found a mistake or a gap?', 'Tell us', 'and we will fix the page.'],
    onThisPage: 'On this page',
  },
  br: {
    nav: 'Documentação',
    filter: 'Filtrar páginas',
    noMatch: 'Nenhuma página encontrada.',
    notFound: 'Página não encontrada',
    notFoundBody: ['Não existe página de documentação em', 'Ela pode ter mudado de lugar; a barra lateral lista todas as páginas atuais.'],
    back: 'Voltar à visão geral',
    docTitle: (page) => `${page} - Docs do Faelith`,
    documentation: 'Documentação',
    previous: 'Anterior',
    next: 'Próxima',
    feedback: ['Achou um erro ou uma lacuna?', 'Avise a gente', 'e corrigimos a página.'],
    onThisPage: 'Nesta página',
  },
  pt: {
    nav: 'Documentação',
    filter: 'Filtrar páginas',
    noMatch: 'Nenhuma página corresponde.',
    notFound: 'Página não encontrada',
    notFoundBody: ['Não existe página de documentação em', 'Pode ter mudado de sítio; a barra lateral lista todas as páginas atuais.'],
    back: 'Voltar à visão geral',
    docTitle: (page) => `${page} - Docs do Faelith`,
    documentation: 'Documentação',
    previous: 'Anterior',
    next: 'Seguinte',
    feedback: ['Encontrou um erro ou uma lacuna?', 'Diga-nos', 'e corrigimos a página.'],
    onThisPage: 'Nesta página',
  },
};
import styles from './Docs.module.css';
import { DocsMarkdown } from './DocsMarkdown';

/**
 * Tracks which `##` section is in view so the right rail can highlight it.
 */
function useActiveHeading(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    setActive(ids[0] ?? null);
    if (ids.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );
    ids.forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

/**
 * Sidebar with grouped page links and a filter box.
 */
function Sidebar({ current, all, locale, t }: { current: DocPage | null; all: DocPage[]; locale: Locale; t: DocsStrings }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const pages = needle ? all.filter((page) => `${page.title} ${page.summary}`.toLowerCase().includes(needle)) : all;
  return (
    <nav className={styles.sidebar} aria-label={t.nav}>
      <label className={styles.search}>
        <span className={styles.srOnly}>{t.filter}</span>
        <input type="search" placeholder={t.filter} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {DOC_GROUPS.map((group) => {
        const rows = pages.filter((page) => page.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group} className={styles.group}>
            <h4>{docGroupLabel(group, locale)}</h4>
            {rows.map((page) => (
              <Link key={page.slug} to={`/docs/${page.slug}`} className={page.slug === current?.slug ? styles.active : undefined} aria-current={page.slug === current?.slug ? 'page' : undefined}>
                {page.title}
              </Link>
            ))}
          </div>
        );
      })}
      {pages.length === 0 && <p className={styles.empty}>{t.noMatch}</p>}
    </nav>
  );
}

/**
 * Not-found article shown for an unknown slug; keeps the user inside the docs.
 */
function NotFound({ slug, t }: { slug: string; t: DocsStrings }) {
  return (
    <article className={styles.article}>
      <p className="kicker">Docs</p>
      <h1>{t.notFound}</h1>
      <p className={styles.summary}>
        {t.notFoundBody[0]} <code>/docs/{slug}</code>. {t.notFoundBody[1]}
      </p>
      <p>
        <Link to="/docs" className="btn btn-primary btn-sm">
          {t.back}
        </Link>
      </p>
    </article>
  );
}

/**
 * Documentation page: sidebar, article and heading rail.
 */
export function DocsPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { locale } = useLocale();
  const t = T[locale];
  const pages = useMemo(() => docPagesFor(locale), [locale]);
  const page = findDoc(slug, pages);
  const headings = useMemo(() => (page ? extractHeadings(page.body) : []), [page]);
  const ids = useMemo(() => headings.map((heading) => heading.id), [headings]);
  const active = useActiveHeading(ids);
  const index = page ? pages.indexOf(page) : -1;
  const previous = index > 0 ? pages[index - 1] : null;
  const next = index >= 0 && index < pages.length - 1 ? pages[index + 1] : null;

  useEffect(() => {
    document.title = page ? t.docTitle(page.title) : 'Faelith Docs';
  }, [page, t]);

  useEffect(() => {
    // Deep links: the layout scrolls to top on route change, so re-apply the hash.
    if (!location.hash) return;
    const node = document.getElementById(location.hash.slice(1));
    if (node) window.requestAnimationFrame(() => node.scrollIntoView({ block: 'start' }));
  }, [location.hash, page]);

  return (
    <div className={`page ${styles.docs}`}>
      <details className={styles.mobileNav}>
        <summary>
          <Icon name="menu" size={16} />
          {page ? page.title : t.documentation}
        </summary>
        <Sidebar current={page} all={pages} locale={locale} t={t} />
      </details>
      <div className={styles.desktopNav}>
        <Sidebar current={page} all={pages} locale={locale} t={t} />
      </div>

      {page ? (
        <article className={styles.article}>
          <p className="kicker">{docGroupLabel(page.group, locale)}</p>
          <h1>{page.title}</h1>
          <p className={styles.summary}>{page.summary}</p>
          <DocsMarkdown text={page.body} />
          <footer className={styles.pager}>
            {previous ? (
              <Link to={`/docs/${previous.slug}`} className={styles.pagerLink}>
                <span>{t.previous}</span>
                <strong>{previous.title}</strong>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link to={`/docs/${next.slug}`} className={`${styles.pagerLink} ${styles.pagerNext}`}>
                <span>{t.next}</span>
                <strong>{next.title}</strong>
              </Link>
            ) : (
              <span />
            )}
          </footer>
          <p className={styles.feedback}>
            {t.feedback[0]} <Link to="/contact">{t.feedback[1]}</Link> {t.feedback[2]}
          </p>
        </article>
      ) : (
        <NotFound slug={slug ?? ''} t={t} />
      )}

      <aside className={styles.toc} aria-label={t.onThisPage}>
        {headings.length > 0 && (
          <>
            <h4>{t.onThisPage}</h4>
            {headings.map((heading) => (
              <a key={heading.id} href={`#${heading.id}`} className={heading.id === active ? styles.tocActive : undefined}>
                {heading.text}
              </a>
            ))}
          </>
        )}
      </aside>
    </div>
  );
}
