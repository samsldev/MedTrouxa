/**
 * @fileoverview Public page that consumes an emailed reset link and sets a new password.
 * @author Samuel S. L.
 * @version 1.1.0
 * @since 2026-09-24
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
 * - Reads the token from the URL fragment (never sent to the server in the URL)
 * - Clears the fragment immediately so the token does not linger in history
 * - After a reset every session is signed out; the user signs in again (2FA still applies)
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../../components/AuthShell';
import { ApiError, resetPassword } from '../../lib/api';
import { useT, type Dict } from '../../lib/i18n';

interface ResetStrings {
  mismatch: string;
  failed: string;
  kicker: string;
  title: [string, string];
  needLink: string;
  request: string;
  incomplete: string;
  done: string;
  signIn: string;
  withNew: string;
  newPassword: string;
  placeholder: string;
  confirm: string;
  saving: string;
  save: string;
}

const T: Dict<ResetStrings> = {
  en: {
    mismatch: 'Passwords do not match',
    failed: 'Could not reset the password',
    kicker: 'Account',
    title: ['Choose a new ', 'password.'],
    needLink: 'Need a new link?',
    request: 'Request one',
    incomplete: 'This reset link is incomplete. Open the link from the email again.',
    done: 'Password updated and every session signed out.',
    signIn: 'Sign in',
    withNew: 'with the new password.',
    newPassword: 'New password',
    placeholder: 'At least 10 characters',
    confirm: 'Confirm password',
    saving: 'Saving…',
    save: 'Set new password',
  },
  br: {
    mismatch: 'As senhas não coincidem',
    failed: 'Não foi possível redefinir a senha',
    kicker: 'Conta',
    title: ['Escolha uma nova ', 'senha.'],
    needLink: 'Precisa de um novo link?',
    request: 'Peça um',
    incomplete: 'Este link de redefinição está incompleto. Abra de novo o link do e-mail.',
    done: 'Senha atualizada e todas as sessões encerradas.',
    signIn: 'Entre',
    withNew: 'com a nova senha.',
    newPassword: 'Nova senha',
    placeholder: 'Pelo menos 10 caracteres',
    confirm: 'Confirmar senha',
    saving: 'Salvando…',
    save: 'Definir nova senha',
  },
  pt: {
    mismatch: 'As palavras-passe não coincidem',
    failed: 'Não foi possível repor a palavra-passe',
    kicker: 'Conta',
    title: ['Escolha uma nova ', 'palavra-passe.'],
    needLink: 'Precisa de uma nova ligação?',
    request: 'Peça uma',
    incomplete: 'Esta ligação de reposição está incompleta. Abra novamente a ligação do e-mail.',
    done: 'Palavra-passe atualizada e todas as sessões terminadas.',
    signIn: 'Inicie sessão',
    withNew: 'com a nova palavra-passe.',
    newPassword: 'Nova palavra-passe',
    placeholder: 'Pelo menos 10 caracteres',
    confirm: 'Confirmar palavra-passe',
    saving: 'A guardar…',
    save: 'Definir nova palavra-passe',
  },
};

/**
 * Takes `token` from `#token=...` once and scrubs it from the address bar.
 */
function takeFragmentToken(): string {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return token;
}

/**
 * New-password form bound to a single-use reset token.
 */
export function ResetPasswordPage() {
  const t = useT(T);
  const [token] = useState(takeFragmentToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Validates locally, then consumes the token. */
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError(t.mismatch);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      kicker={t.kicker}
      showOAuth={false}
      title={
        <>
          {t.title[0]}<span className="serif">{t.title[1]}</span>
        </>
      }
      footer={
        <>
          {t.needLink} <Link to="/forgot-password">{t.request}</Link>
        </>
      }
    >
      {!token ? (
        <p className="notice notice-error">{t.incomplete}</p>
      ) : done ? (
        <p className="notice">
          {t.done} <Link to="/login">{t.signIn}</Link> {t.withNew}
        </p>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)}>
          <label className="field">
            <span>{t.newPassword}</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder={t.placeholder}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={10}
              maxLength={256}
            />
          </label>
          <label className="field">
            <span>{t.confirm}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              minLength={10}
              maxLength={256}
            />
          </label>
          {error ? <p className="notice notice-error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: '100%' }}>
            {pending ? t.saving : t.save}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
