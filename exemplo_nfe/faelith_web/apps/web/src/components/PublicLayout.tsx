/**
 * @fileoverview Public layout with floating pill header, mobile menu, and multi-column footer.
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
 * - Renders Models, Products, Pricing, Resources, Docs inside a centered glass pill nav
 * - Tightens the header on scroll and exposes a hamburger menu under 900px
 * - Places Login, Contact, and Download in the header actions
 * - Footer groups Product, Company, and Legal columns with a large wordmark
 * - Scrolls to top and closes the mobile menu on every route change
 * - Localized (en, pt-BR, pt-PT) with a language switcher in the header and footer
 */

import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { resetConsent } from '../lib/analytics';
import { useT, type Dict } from '../lib/i18n';
import { Icon } from './Icons';
import { LanguageSwitcher } from './LanguageSwitcher';
import styles from './PublicLayout.module.css';

interface LayoutStrings {
  nav: { to: string; label: string }[];
  footer: { title: string; links: { to: string; label: string }[] }[];
  login: string;
  contact: string;
  download: string;
  openMenu: string;
  closeMenu: string;
  tagline: string;
  status: string;
  rights: string;
  cookies: string;
  meta: string;
}

const T: Dict<LayoutStrings> = {
  en: {
    nav: [
      { to: '/models', label: 'Models' },
      { to: '/products', label: 'Products' },
      { to: '/pricing', label: 'Pricing' },
      { to: '/resources', label: 'Resources' },
      { to: '/docs', label: 'Docs' },
    ],
    footer: [
      { title: 'Product', links: [{ to: '/products', label: 'Code' }, { to: '/products', label: 'CLI' }, { to: '/products', label: 'Chat' }, { to: '/products', label: 'API' }, { to: '/download', label: 'Download' }] },
      { title: 'Platform', links: [{ to: '/models', label: 'Echo and Horizon' }, { to: '/pricing', label: 'Pricing' }, { to: '/docs', label: 'Docs' }, { to: '/changelog', label: 'Changelog' }] },
      { title: 'Company', links: [{ to: '/contact', label: 'Contact sales' }, { to: '/login', label: 'Login' }, { to: '/signup', label: 'Create account' }, { to: '/terms', label: 'Terms of Service' }] },
    ],
    login: 'Login',
    contact: 'Contact',
    download: 'Download',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    tagline: 'Production-grade intelligence for people who ship. Echo and Horizon across Code, CLI, Chat, and API, on one account with one honest rate card.',
    status: 'All systems operational',
    rights: '© 2026 Faelith Industries. All rights reserved.',
    cookies: 'Cookie preferences',
    meta: 'ZDR inference · Encrypted Faelith capture · Prepaid credits',
  },
  br: {
    nav: [
      { to: '/models', label: 'Modelos' },
      { to: '/products', label: 'Produtos' },
      { to: '/pricing', label: 'Preços' },
      { to: '/resources', label: 'Recursos' },
      { to: '/docs', label: 'Docs' },
    ],
    footer: [
      { title: 'Produto', links: [{ to: '/products', label: 'Code' }, { to: '/products', label: 'CLI' }, { to: '/products', label: 'Chat' }, { to: '/products', label: 'API' }, { to: '/download', label: 'Download' }] },
      { title: 'Plataforma', links: [{ to: '/models', label: 'Echo e Horizon' }, { to: '/pricing', label: 'Preços' }, { to: '/docs', label: 'Docs' }, { to: '/changelog', label: 'Changelog' }] },
      { title: 'Empresa', links: [{ to: '/contact', label: 'Falar com vendas' }, { to: '/login', label: 'Entrar' }, { to: '/signup', label: 'Criar conta' }, { to: '/terms', label: 'Termos de Serviço' }] },
    ],
    login: 'Entrar',
    contact: 'Contato',
    download: 'Download',
    openMenu: 'Abrir menu',
    closeMenu: 'Fechar menu',
    tagline: 'Inteligência de nível de produção para quem entrega. Echo e Horizon no Code, CLI, Chat e API, em uma conta só, com uma tabela de preços honesta.',
    status: 'Todos os sistemas operacionais',
    rights: '© 2026 Faelith Industries. Todos os direitos reservados.',
    cookies: 'Preferências de cookies',
    meta: 'Inferência ZDR · Captura Faelith criptografada · Créditos pré-pagos',
  },
  pt: {
    nav: [
      { to: '/models', label: 'Modelos' },
      { to: '/products', label: 'Produtos' },
      { to: '/pricing', label: 'Preços' },
      { to: '/resources', label: 'Recursos' },
      { to: '/docs', label: 'Docs' },
    ],
    footer: [
      { title: 'Produto', links: [{ to: '/products', label: 'Code' }, { to: '/products', label: 'CLI' }, { to: '/products', label: 'Chat' }, { to: '/products', label: 'API' }, { to: '/download', label: 'Transferir' }] },
      { title: 'Plataforma', links: [{ to: '/models', label: 'Echo e Horizon' }, { to: '/pricing', label: 'Preços' }, { to: '/docs', label: 'Docs' }, { to: '/changelog', label: 'Changelog' }] },
      { title: 'Empresa', links: [{ to: '/contact', label: 'Falar com vendas' }, { to: '/login', label: 'Iniciar sessão' }, { to: '/signup', label: 'Criar conta' }, { to: '/terms', label: 'Termos de Serviço' }] },
    ],
    login: 'Iniciar sessão',
    contact: 'Contacto',
    download: 'Transferir',
    openMenu: 'Abrir menu',
    closeMenu: 'Fechar menu',
    tagline: 'Inteligência de nível de produção para quem entrega. Echo e Horizon no Code, CLI, Chat e API, numa só conta, com uma tabela de preços honesta.',
    status: 'Todos os sistemas operacionais',
    rights: '© 2026 Faelith Industries. Todos os direitos reservados.',
    cookies: 'Preferências de cookies',
    meta: 'Inferência ZDR · Captura Faelith cifrada · Créditos pré-pagos',
  },
};

/**
 * Applies the active class when a public nav destination matches.
 */
function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? styles.navActive : '';
}

/**
 * Brand lockup: a rotated gold square mark with the wordmark.
 */
function Logo() {
  return (
    <Link to="/" className={styles.logo} aria-label="Faelith home">
      <span className={styles.mark} aria-hidden="true" />
      <span>Faelith</span>
    </Link>
  );
}

/**
 * Marketing chrome used by every unauthenticated public route.
 */
export function PublicLayout() {
  const t = useT(T);
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    /**
     * Toggles the compact header state once the page scrolls past the hero top.
     */
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className={styles.shell}>
      <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
        <div className={styles.headerInner}>
          <Logo />
          <nav className={styles.nav} aria-label="Primary">
            {t.nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className={styles.actions}>
            <LanguageSwitcher />
            <NavLink to="/login" className={({ isActive }) => `${styles.login} ${navClass({ isActive })}`}>
              {t.login}
            </NavLink>
            <Link to="/contact" className="btn btn-ghost btn-sm">
              {t.contact}
            </Link>
            <Link to="/download" className="btn btn-primary btn-sm">
              {t.download}
            </Link>
          </div>
          <button
            type="button"
            className={styles.burger}
            aria-label={menuOpen ? t.closeMenu : t.openMenu}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
          </button>
        </div>
      </header>

      <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileOpen : ''}`} aria-hidden={!menuOpen}>
        <nav className={styles.mobileNav} aria-label="Mobile">
          {t.nav.map((item, index) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={navClass}
              style={{ ['--delay' as string]: `${index * 40}ms` }}
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/login" className={navClass} style={{ ['--delay' as string]: '160ms' }}>
            {t.login}
          </NavLink>
        </nav>
        <div className={styles.mobileActions}>
          <LanguageSwitcher />
          <Link to="/contact" className="btn btn-ghost">
            {t.contact}
          </Link>
          <Link to="/download" className="btn btn-primary">
            {t.download}
          </Link>
        </div>
      </div>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <Logo />
              <p className={styles.footerTagline}>{t.tagline}</p>
              <div className={styles.statusRow}>
                <span className={styles.statusDot} />
                {t.status}
              </div>
              <LanguageSwitcher />
            </div>
            <div className={styles.footerColumns}>
              {t.footer.map((column) => (
                <div key={column.title} className={styles.footerColumn}>
                  <h4>{column.title}</h4>
                  {column.links.map((link) => (
                    <Link key={`${column.title}-${link.label}`} to={link.to}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>{t.rights}</span>
            <button type="button" className="link-button" onClick={resetConsent}>
              {t.cookies}
            </button>
            <span className={styles.footerMeta}>{t.meta}</span>
          </div>
        </div>
        <div className={styles.bigWord} aria-hidden="true">
          Faelith
        </div>
      </footer>
    </div>
  );
}
