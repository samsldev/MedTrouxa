/**
 * @fileoverview Authenticated application chrome with icon sidebar, user block, and top bar.
 * @author Samuel S. L.
 * @version 2.2.0
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
 * - Sidebar with brand, iconized navigation, and a plan badge for the signed-in user
 * - Content column with a slim top bar showing the current section and a back-to-site link
 * - Collapses to a horizontal scrolling nav under 900px
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useT, type Dict } from '../lib/i18n';
import { planDisplayName } from '../lib/plans';
import styles from './DashboardLayout.module.css';
import { Icon, type IconName } from './Icons';
import { LanguageSwitcher } from './LanguageSwitcher';

interface Item {
  to: string;
  end: boolean;
  icon: IconName;
}

const ITEMS: Item[] = [
  { to: '/app', end: true, icon: 'home' },
  { to: '/app/chat', end: false, icon: 'chat' },
  { to: '/app/usage', end: false, icon: 'gauge' },
  { to: '/app/spending', end: false, icon: 'wallet' },
  { to: '/app/keys', end: false, icon: 'key' },
  { to: '/app/billing', end: false, icon: 'receipt' },
  { to: '/app/settings', end: false, icon: 'settings' },
];

/** Shown only to users listed in ADMIN_EMAILS. */
const ADMIN_ITEM: Item = { to: '/app/admin', end: false, icon: 'shield' };

interface DashStrings {
  labels: Record<string, string>;
  noPlan: string;
  dashboard: string;
  back: string;
}

const T: Dict<DashStrings> = {
  en: {
    labels: { '/app': 'Overview', '/app/chat': 'Chat', '/app/usage': 'Usage', '/app/spending': 'Spending', '/app/keys': 'API Keys', '/app/billing': 'Billing & Invoices', '/app/settings': 'Settings', '/app/admin': 'Admin' },
    noPlan: 'No plan',
    dashboard: 'Dashboard',
    back: 'Back to site',
  },
  br: {
    labels: { '/app': 'Visão geral', '/app/chat': 'Chat', '/app/usage': 'Uso', '/app/spending': 'Gastos', '/app/keys': 'Chaves de API', '/app/billing': 'Cobrança e faturas', '/app/settings': 'Configurações', '/app/admin': 'Admin' },
    noPlan: 'Sem plano',
    dashboard: 'Painel',
    back: 'Voltar ao site',
  },
  pt: {
    labels: { '/app': 'Visão geral', '/app/chat': 'Chat', '/app/usage': 'Utilização', '/app/spending': 'Gastos', '/app/keys': 'Chaves de API', '/app/billing': 'Faturação e faturas', '/app/settings': 'Definições', '/app/admin': 'Admin' },
    noPlan: 'Sem plano',
    dashboard: 'Painel',
    back: 'Voltar ao site',
  },
};

/**
 * Resolves the dashboard path of the current section, used for the top bar label.
 */
function currentPath(pathname: string): string {
  const all = [...ITEMS, ADMIN_ITEM];
  const exact = all.find((item) => item.to === pathname);
  if (exact) {
    return exact.to;
  }
  const prefix = all.find((item) => !item.end && pathname.startsWith(item.to));
  return prefix?.to ?? '/app';
}

/**
 * Derives up to two uppercase initials from a display name or email.
 */
function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Authenticated application chrome. Session gating lives in RequireAuth.
 */
export function DashboardLayout() {
  const t = useT(T);
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className={styles.frame}>
      <aside className={styles.side}>
        <Link to="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          Faelith
        </Link>
        <nav className={styles.nav} aria-label={t.dashboard}>
          {(user?.admin ? [...ITEMS, ADMIN_ITEM] : ITEMS).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? styles.active : '')}
            >
              <Icon name={item.icon} size={16} />
              <span>{t.labels[item.to]}</span>
            </NavLink>
          ))}
        </nav>
        {user ? (
          <div className={styles.user}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(user.name, user.email)}
            </span>
            <span className={styles.userMeta}>
              <span className={styles.userName}>{user.name || user.email}</span>
              <span className={styles.userPlan}>{user.plan ? planDisplayName(user.plan) : t.noPlan}</span>
            </span>
          </div>
        ) : null}
      </aside>
      <section className={styles.content}>
        <div className={styles.topbar}>
          <span className={styles.crumb}>
            <span className={styles.crumbMuted}>{t.dashboard}</span>
            <span className={styles.crumbSep}>/</span>
            {t.labels[currentPath(location.pathname)]}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <LanguageSwitcher />
            <Link to="/" className={styles.backLink}>
              {t.back}
              <Icon name="arrow" size={14} />
            </Link>
          </span>
        </div>
        <div className={location.pathname.startsWith('/app/chat') ? styles.innerBleed : styles.inner}>
          <Outlet />
        </div>
      </section>
    </div>
  );
}
