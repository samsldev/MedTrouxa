/**
 * @fileoverview Markdown renderer for the public Docs, Changelog and Terms pages: anchored headings, router links, copyable code.
 * @author Samuel S. L.
 * @version 1.0.0
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
 * - `##` and `###` headings receive GitHub-style ids so the "On this page"
 *   rail and deep links work; each heading carries a hover anchor
 * - Links: same-origin paths go through the router (no full reload),
 *   everything else opens in a new tab with rel=noreferrer
 * - Fenced code renders with a language label and a copy button; inline code
 *   stays inline. Tables get a horizontal scroll wrapper
 * - Pure presentation: the caller passes the Markdown string
 */
import { memo, useState, type ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { Icon } from '../components/Icons';
import { slugifyHeading } from './content';
import styles from './Docs.module.css';

const REMARK_PLUGINS = [remarkGfm];

/** Flattens React children to their text content (for heading ids and copy). */
function textOf(children: ReactNode): string {
  if (children === null || children === undefined || typeof children === 'boolean') return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textOf).join('');
  if (typeof children === 'object' && 'props' in children) {
    return textOf((children as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

/**
 * Heading with a stable id and a hover anchor link, shared by h2 and h3.
 */
function Heading({ level, children }: { level: 2 | 3; children?: ReactNode }) {
  const id = slugifyHeading(textOf(children));
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <Tag id={id} className={styles.heading}>
      {children}
      <a href={`#${id}`} className={styles.anchor} aria-label="Link to this section">
        #
      </a>
    </Tag>
  );
}

/**
 * Fenced code block with a language label and a copy-to-clipboard control.
 */
function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const language = /language-(\w+)/.exec(className ?? '')?.[1] ?? 'text';
  const text = String(children ?? '').replace(/\n$/, '');
  /** Writes the block to the clipboard and flashes the check icon. */
  function copy() {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }
  return (
    <div className={styles.codeblock}>
      <div className={styles.codebar}>
        <span>{language}</span>
        <button type="button" className={styles.copy} aria-label="Copy code" onClick={copy}>
          <Icon name={copied ? 'check' : 'copy'} size={13} />
        </button>
      </div>
      <pre>
        <code className={className}>{text}</code>
      </pre>
    </div>
  );
}

/**
 * Router-aware link: internal paths navigate client-side, external open in a new tab.
 */
function DocLink({ href, children }: { href?: string; children?: ReactNode }) {
  if (!href) return <>{children}</>;
  const internal = href.startsWith('/') && !href.startsWith('//');
  if (internal) return <Link to={href}>{children}</Link>;
  if (href.startsWith('#')) return <a href={href}>{children}</a>;
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

const COMPONENTS: Components = {
  h2: ({ children }) => <Heading level={2}>{children}</Heading>,
  h3: ({ children }) => <Heading level={3}>{children}</Heading>,
  a: ({ href, children }) => <DocLink href={href}>{children}</DocLink>,
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, node }) => {
    void node;
    const isBlock = Boolean(className) || String(children ?? '').includes('\n');
    return isBlock ? <CodeBlock className={className}>{children}</CodeBlock> : <code>{children}</code>;
  },
  table: ({ children }) => (
    <div className={styles.tableWrap}>
      <table>{children}</table>
    </div>
  ),
};

/**
 * Renders a documentation Markdown body. memo skips re-parsing while the
 * scroll-spy re-renders the surrounding layout.
 */
export const DocsMarkdown = memo(function DocsMarkdown({ text }: { text: string }) {
  return (
    <div className={styles.prose}>
      <Markdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {text}
      </Markdown>
    </div>
  );
});
