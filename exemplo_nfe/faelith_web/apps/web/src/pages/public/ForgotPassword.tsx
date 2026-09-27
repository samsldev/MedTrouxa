/**
 * @fileoverview Public "forgot password" page that requests an emailed reset link.
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
 * - Always shows the same confirmation, so the form never reveals registered emails
 * - The link itself is handled by /reset-password
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../../components/AuthShell';
import { ApiError, requestPasswordReset } from '../../lib/api';
import { useT, type Dict } from '../../lib/i18n';

interface ForgotStrings {
  failed: string;
  kicker: string;
  title: [string, string];
  remembered: string;
  signIn: string;
  sent: (email: string) => string;
  email: string;
  sending: string;
  send: string;
}

const T: Dict<ForgotStrings> = {
  en: {
    failed: 'Could not send the reset link',
    kicker: 'Account',
    title: ['Reset your ', 'password.'],
    remembered: 'Remembered it?',
    signIn: 'Sign in',
    sent: (email) => `If an account exists for ${email}, a reset link is on its way. It works once and expires in 30 minutes.`,
    email: 'Email',
    sending: 'Sending…',
    send: 'Send reset link',
  },
  br: {
    failed: 'Não foi possível enviar o link de redefinição',
    kicker: 'Conta',
    title: ['Redefina sua ', 'senha.'],
    remembered: 'Lembrou?',
    signIn: 'Entrar',
    sent: (email) => `Se existir uma conta para ${email}, um link de redefinição está a caminho. Ele funciona uma vez e expira em 30 minutos.`,
    email: 'E-mail',
    sending: 'Enviando…',
    send: 'Enviar link de redefinição',
  },
  pt: {
    failed: 'Não foi possível enviar a ligação de reposição',
    kicker: 'Conta',
    title: ['Reponha a sua ', 'palavra-passe.'],
    remembered: 'Lembrou-se?',
    signIn: 'Iniciar sessão',
    sent: (email) => `Se existir uma conta para ${email}, está a caminho uma ligação de reposição. Funciona uma vez e expira em 30 minutos.`,
    email: 'E-mail',
    sending: 'A enviar…',
    send: 'Enviar ligação de reposição',
  },
};

/**
 * Collects the account email and asks the server to send a reset link.
 */
export function ForgotPasswordPage() {
  const t = useT(T);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Submits the email; the server answers identically for unknown addresses. */
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
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
          {t.remembered} <Link to="/login">{t.signIn}</Link>
        </>
      }
    >
      {sent ? (
        <p className="notice">{t.sent(email)}</p>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)}>
          <label className="field">
            <span>{t.email}</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {error ? <p className="notice notice-error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: '100%' }}>
            {pending ? t.sending : t.send}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
