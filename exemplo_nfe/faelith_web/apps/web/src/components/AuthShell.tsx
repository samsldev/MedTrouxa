/**
 * @fileoverview Split-screen authentication shell shared by Login and Signup.
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
 * - Left brand panel with serif quote and platform facts, hidden under 980px
 * - Right column hosts the form, OAuth buttons, and a footer link
 * - OAuth buttons are rendered from the provider union with matching icons
 * - `showOAuth={false}` hides the provider row on code-entry steps (signup code, 2FA)
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import type { ReactNode } from 'react';
import { oauthLabel, oauthPath } from '../lib/format';
import { useT, type Dict } from '../lib/i18n';
import type { OAuthProvider } from '../lib/types';
import { Icon } from './Icons';
import styles from '../pages/public/Marketing.module.css';

const PROVIDERS: OAuthProvider[] = ['github', 'google'];

interface AuthShellProps {
  kicker: string;
  title: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  /** Provider buttons and divider; off for code-entry steps. Defaults to true. */
  showOAuth?: boolean;
}

interface ShellStrings {
  quote: string;
  facts: [string, string, string];
  divider: string;
}

const T: Dict<ShellStrings> = {
  en: {
    quote: 'The account you open today follows you from the first commit to the last deploy.',
    facts: ['ZDR at the inference provider.', 'Prepaid credits. No invoice you did not choose.', 'Echo and Horizon, 256k and 1M, on every surface.'],
    divider: 'or continue with email',
  },
  br: {
    quote: 'A conta que você abre hoje acompanha você do primeiro commit ao último deploy.',
    facts: ['ZDR no provedor de inferência.', 'Créditos pré-pagos. Nenhuma fatura que você não escolheu.', 'Echo e Horizon, 256k e 1M, em todas as ferramentas.'],
    divider: 'ou continue com e-mail',
  },
  pt: {
    quote: 'A conta que abre hoje acompanha-o do primeiro commit ao último deploy.',
    facts: ['ZDR no fornecedor de inferência.', 'Créditos pré-pagos. Nenhuma fatura que não escolheu.', 'Echo e Horizon, 256k e 1M, em todas as ferramentas.'],
    divider: 'ou continue com e-mail',
  },
};

/**
 * Renders the two-column auth layout. The form is injected as children so each
 * page keeps ownership of its own state and submit logic.
 */
export function AuthShell({ kicker, title, children, footer, showOAuth = true }: AuthShellProps) {
  const t = useT(T);
  return (
    <div className={styles.auth}>
      <aside className={styles.authBrand}>
        <p className="kicker">Faelith Industries</p>
        <p className={styles.authQuote}>{t.quote}</p>
        <div className={styles.authFacts}>
          <span>
            <Icon name="shield" size={16} />
            {t.facts[0]}
          </span>
          <span>
            <Icon name="wallet" size={16} />
            {t.facts[1]}
          </span>
          <span>
            <Icon name="bolt" size={16} />
            {t.facts[2]}
          </span>
        </div>
      </aside>
      <section className={styles.authForm}>
        <div className={`${styles.authFormInner} fade-up`}>
          <p className="kicker">{kicker}</p>
          <h1 className={styles.authTitle}>{title}</h1>
          {showOAuth ? (
            <>
              <div className={styles.oauthRow}>
                {PROVIDERS.map((provider) => (
                  <a key={provider} className="btn btn-ghost" href={oauthPath(provider)}>
                    <Icon name={provider} size={16} />
                    {oauthLabel(provider)}
                  </a>
                ))}
              </div>
              <div className={styles.divider}>{t.divider}</div>
            </>
          ) : null}
          {children}
          <p className={styles.authFooter}>{footer}</p>
        </div>
      </section>
    </div>
  );
}
