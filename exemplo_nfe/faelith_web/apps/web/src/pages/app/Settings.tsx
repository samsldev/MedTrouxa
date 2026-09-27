/**
 * @fileoverview Account settings: profile, password, OAuth, logout, and delete.
 * @author Samuel S. L.
 * @version 1.2.0
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
 * - Patches display name and keeps email read-only
 * - Changes password with a 10-character minimum
 * - Links or unlinks GitHub/Google and supports logout plus account deletion
 * - Hosts the two-factor authentication card (SecuritySettings)
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  changePassword,
  deleteAccount,
  logout,
  patchSettings,
  unlinkOAuth,
} from '../../lib/api';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { SecuritySettings } from '../../components/SecuritySettings';
import { useAuth } from '../../lib/AuthContext';
import { oauthLabel, oauthPath } from '../../lib/format';
import { useT, type Dict } from '../../lib/i18n';
import type { OAuthProvider } from '../../lib/types';
import styles from './Dashboard.module.css';

const PROVIDERS: OAuthProvider[] = ['github', 'google'];

interface SettingsStrings {
  nameUpdated: string;
  nameFailed: string;
  passwordShort: string;
  passwordUpdated: string;
  passwordFailed: string;
  unlinked: (provider: string) => string;
  unlinkFailed: string;
  confirmDelete: string;
  deleteFailed: string;
  kicker: string;
  title: string;
  name: string;
  email: string;
  saveName: string;
  password: string;
  current: string;
  newPassword: string;
  changePassword: string;
  language: string;
  linked: string;
  notLinked: string;
  unlink: string;
  link: (provider: string) => string;
  logout: string;
  deleteAccount: string;
}

const T: Dict<SettingsStrings> = {
  en: {
    nameUpdated: 'Name updated.',
    nameFailed: 'Unable to update name',
    passwordShort: 'New password must be at least 10 characters',
    passwordUpdated: 'Password updated.',
    passwordFailed: 'Unable to change password',
    unlinked: (provider) => `${provider} unlinked.`,
    unlinkFailed: 'Unable to unlink provider',
    confirmDelete: 'Delete this account permanently? This cannot be undone.',
    deleteFailed: 'Unable to delete account',
    kicker: 'Settings',
    title: 'Account settings',
    name: 'Name',
    email: 'Email',
    saveName: 'Save name',
    password: 'Password',
    current: 'Current',
    newPassword: 'New (min 10 characters)',
    changePassword: 'Change password',
    language: 'Language',
    linked: 'Linked',
    notLinked: 'Not linked',
    unlink: 'Unlink',
    link: (provider) => `Link ${provider}`,
    logout: 'Log out',
    deleteAccount: 'Delete account',
  },
  br: {
    nameUpdated: 'Nome atualizado.',
    nameFailed: 'Não foi possível atualizar o nome',
    passwordShort: 'A nova senha precisa ter pelo menos 10 caracteres',
    passwordUpdated: 'Senha atualizada.',
    passwordFailed: 'Não foi possível trocar a senha',
    unlinked: (provider) => `${provider} desvinculado.`,
    unlinkFailed: 'Não foi possível desvincular o provedor',
    confirmDelete: 'Excluir esta conta permanentemente? Isso não pode ser desfeito.',
    deleteFailed: 'Não foi possível excluir a conta',
    kicker: 'Configurações',
    title: 'Configurações da conta',
    name: 'Nome',
    email: 'E-mail',
    saveName: 'Salvar nome',
    password: 'Senha',
    current: 'Atual',
    newPassword: 'Nova (mínimo de 10 caracteres)',
    changePassword: 'Trocar senha',
    language: 'Idioma',
    linked: 'Vinculado',
    notLinked: 'Não vinculado',
    unlink: 'Desvincular',
    link: (provider) => `Vincular ${provider}`,
    logout: 'Sair',
    deleteAccount: 'Excluir conta',
  },
  pt: {
    nameUpdated: 'Nome atualizado.',
    nameFailed: 'Não foi possível atualizar o nome',
    passwordShort: 'A nova palavra-passe tem de ter pelo menos 10 caracteres',
    passwordUpdated: 'Palavra-passe atualizada.',
    passwordFailed: 'Não foi possível alterar a palavra-passe',
    unlinked: (provider) => `${provider} desassociado.`,
    unlinkFailed: 'Não foi possível desassociar o fornecedor',
    confirmDelete: 'Eliminar esta conta permanentemente? Esta ação não pode ser anulada.',
    deleteFailed: 'Não foi possível eliminar a conta',
    kicker: 'Definições',
    title: 'Definições da conta',
    name: 'Nome',
    email: 'E-mail',
    saveName: 'Guardar nome',
    password: 'Palavra-passe',
    current: 'Atual',
    newPassword: 'Nova (mínimo de 10 caracteres)',
    changePassword: 'Alterar palavra-passe',
    language: 'Idioma',
    linked: 'Associado',
    notLinked: 'Não associado',
    unlink: 'Desassociar',
    link: (provider) => `Associar ${provider}`,
    logout: 'Terminar sessão',
    deleteAccount: 'Eliminar conta',
  },
};

/**
 * Returns whether the current session reports a given OAuth provider as linked.
 */
function isLinked(github: boolean, google: boolean, provider: OAuthProvider): boolean {
  switch (provider) {
    case 'github':
      return github;
    case 'google':
      return google;
    default: {
      const _never: never = provider;
      return _never;
    }
  }
}

/**
 * Authenticated settings page.
 */
export function SettingsPage() {
  const t = useT(T);
  const { user, refresh, setUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Saves the display name via PATCH /api/settings.
   */
  async function onSaveName(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await patchSettings(name);
      await refresh();
      setNotice(t.nameUpdated);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.nameFailed);
    }
  }

  /**
   * Rotates the password after verifying the current secret.
   */
  async function onChangePassword(event: FormEvent) {
    event.preventDefault();
    if (next.length < 10) {
      setError(t.passwordShort);
      return;
    }
    setError(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setNotice(t.passwordUpdated);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.passwordFailed);
    }
  }

  /**
   * Unlinks an OAuth provider then refreshes session flags.
   */
  async function onUnlink(provider: OAuthProvider) {
    setError(null);
    try {
      await unlinkOAuth(provider);
      await refresh();
      setNotice(t.unlinked(oauthLabel(provider)));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.unlinkFailed);
    }
  }

  /**
   * Ends the cookie session and returns to login.
   */
  async function onLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      navigate('/login');
    }
  }

  /**
   * Permanently deletes the account after an explicit confirm.
   */
  async function onDelete() {
    if (!window.confirm(t.confirmDelete)) {
      return;
    }
    try {
      await deleteAccount();
      setUser(null);
      navigate('/');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.deleteFailed);
    }
  }

  return (
    <div className={styles.wrap}>
      <p className="kicker">{t.kicker}</p>
      <h1 className={styles.title}>{t.title}</h1>
      {notice ? <p className="notice notice-success">{notice}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}
      <form className="card" onSubmit={(event) => void onSaveName(event)}>
        <label className="field">
          <span>{t.name}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span>{t.email}</span>
          <input value={user?.email ?? ''} readOnly />
        </label>
        <button className="btn btn-primary" type="submit">
          {t.saveName}
        </button>
      </form>
      <article className="card" style={{ marginTop: 16 }}>
        <h3>{t.language}</h3>
        <LanguageSwitcher />
      </article>
      <form className="card" style={{ marginTop: 16 }} onSubmit={(event) => void onChangePassword(event)}>
        <h3>{t.password}</h3>
        <label className="field">
          <span>{t.current}</span>
          <input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} required />
        </label>
        <label className="field">
          <span>{t.newPassword}</span>
          <input
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            required
            minLength={10}
          />
        </label>
        <button className="btn btn-primary" type="submit">
          {t.changePassword}
        </button>
      </form>
      <SecuritySettings />
      <article className="card" style={{ marginTop: 16 }}>
        <h3>OAuth</h3>
        {PROVIDERS.map((provider) => {
          const linked = isLinked(user?.githubLinked === true, user?.googleLinked === true, provider);
          return (
            <div key={provider} className="btn-row">
              <span>
                {oauthLabel(provider)}: {linked ? t.linked : t.notLinked}
              </span>
              {linked ? (
                <button type="button" className="btn btn-ghost" onClick={() => void onUnlink(provider)}>
                  {t.unlink}
                </button>
              ) : (
                <a className="btn btn-ghost" href={oauthPath(provider)}>
                  {t.link(oauthLabel(provider))}
                </a>
              )}
            </div>
          );
        })}
      </article>
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={() => void onLogout()}>
          {t.logout}
        </button>
        <button type="button" className="btn btn-danger" onClick={() => void onDelete()}>
          {t.deleteAccount}
        </button>
      </div>
    </div>
  );
}
