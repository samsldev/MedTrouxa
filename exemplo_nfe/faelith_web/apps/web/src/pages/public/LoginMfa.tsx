/**
 * @fileoverview Second-factor sign-in step (authenticator app, email code, or backup code).
 * @author Samuel S. L.
 * @version 1.1.0
 * @since 2026-09-23
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
 * - Reached after a password login or an OAuth callback when the account has 2FA on
 * - Loads the challenge from the HttpOnly cookie; an expired challenge returns to /login
 * - Offers only the methods the account enabled; backup codes are always offered
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../../components/AuthShell';
import { CodeField } from '../../components/CodeField';
import { ApiError, fetchMfaChallenge, sendMfaEmail, verifyMfa } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { useT, type Dict } from '../../lib/i18n';
import { safeNextPath } from '../../lib/nextPath';
import type { MfaChallenge, MfaMethod } from '../../lib/types';

interface MfaStrings {
  methods: Record<MfaMethod, string>;
  sent: (hint: string) => string;
  sendFailed: string;
  verifyFailed: string;
  kicker: string;
  title: [string, string];
  notYou: string;
  startOver: string;
  loading: string;
  totpHelp: string;
  backupHelp: string;
  emailHelp: (hint: string) => string;
  resend: string;
  send: string;
  verifying: string;
  verify: string;
}

const T: Dict<MfaStrings> = {
  en: {
    methods: { totp: 'Authenticator app', email: 'Email code', backup: 'Backup code' },
    sent: (hint) => `Code sent to ${hint}. It expires in 10 minutes.`,
    sendFailed: 'Unable to send the code',
    verifyFailed: 'Verification failed',
    kicker: 'Two-factor authentication',
    title: ['One more ', 'step.'],
    notYou: 'Not you?',
    startOver: 'Start over',
    loading: 'Loading…',
    totpHelp: 'Enter the 6-digit code from your authenticator app.',
    backupHelp: 'Enter one of your backup codes. Each code works only once.',
    emailHelp: (hint) => `We will email a code to ${hint}.`,
    resend: 'Resend code',
    send: 'Send code',
    verifying: 'Verifying…',
    verify: 'Verify and sign in',
  },
  br: {
    methods: { totp: 'App autenticador', email: 'Código por e-mail', backup: 'Código de backup' },
    sent: (hint) => `Código enviado para ${hint}. Ele expira em 10 minutos.`,
    sendFailed: 'Não foi possível enviar o código',
    verifyFailed: 'Não foi possível verificar o código',
    kicker: 'Autenticação em dois fatores',
    title: ['Só mais um ', 'passo.'],
    notYou: 'Não é você?',
    startOver: 'Recomeçar',
    loading: 'Carregando…',
    totpHelp: 'Digite o código de 6 dígitos do seu app autenticador.',
    backupHelp: 'Digite um dos seus códigos de backup. Cada código funciona só uma vez.',
    emailHelp: (hint) => `Vamos enviar um código para ${hint}.`,
    resend: 'Reenviar código',
    send: 'Enviar código',
    verifying: 'Verificando…',
    verify: 'Verificar e entrar',
  },
  pt: {
    methods: { totp: 'Aplicação autenticadora', email: 'Código por e-mail', backup: 'Código de cópia de segurança' },
    sent: (hint) => `Código enviado para ${hint}. Expira em 10 minutos.`,
    sendFailed: 'Não foi possível enviar o código',
    verifyFailed: 'Não foi possível verificar o código',
    kicker: 'Autenticação de dois fatores',
    title: ['Só mais um ', 'passo.'],
    notYou: 'Não é você?',
    startOver: 'Recomeçar',
    loading: 'A carregar…',
    totpHelp: 'Introduza o código de 6 dígitos da sua aplicação autenticadora.',
    backupHelp: 'Introduza um dos seus códigos de cópia de segurança. Cada código só funciona uma vez.',
    emailHelp: (hint) => `Vamos enviar um código para ${hint}.`,
    resend: 'Reenviar código',
    send: 'Enviar código',
    verifying: 'A verificar…',
    verify: 'Verificar e iniciar sessão',
  },
};

/**
 * Two-factor challenge page.
 */
export function LoginMfaPage() {
  const t = useT(T);
  const { user, setUser, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [method, setMethod] = useState<MfaMethod>('totp');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMfaChallenge()
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setChallenge(loaded);
        setMethod(loaded.methods[0] ?? 'backup');
      })
      .catch(() => {
        if (!cancelled) {
          setExpired(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (user) {
    return <Navigate to={next} replace />;
  }
  if (expired) {
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  /**
   * Switches the active method and clears any half-typed code.
   */
  function onSelect(selected: MfaMethod) {
    setMethod(selected);
    setCode('');
    setError(null);
    setNotice(null);
  }

  /**
   * Emails a sign-in code for the pending challenge.
   */
  async function onSendEmail() {
    setError(null);
    try {
      const updated = await sendMfaEmail();
      setChallenge(updated);
      setNotice(t.sent(updated.emailHint));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.sendFailed);
    }
  }

  /**
   * Verifies the code; success sets the session cookie server-side.
   */
  async function onVerify(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const session = await verifyMfa(method, code);
      if (session) {
        setUser(session);
      } else {
        await refresh();
      }
      navigate(next);
    } catch (caught) {
      setCode('');
      if (caught instanceof ApiError && (caught.status === 429 || caught.message.startsWith('sign-in expired'))) {
        setExpired(true);
        return;
      }
      setError(caught instanceof ApiError ? caught.message : t.verifyFailed);
    } finally {
      setPending(false);
    }
  }

  const complete = method === 'backup' ? code.replace(/-/g, '').length === 10 : code.length === 6;

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
          {t.notYou} <Link to="/login">{t.startOver}</Link>
        </>
      }
    >
      {challenge === null ? (
        <p className="muted">{t.loading}</p>
      ) : (
        <form onSubmit={(event) => void onVerify(event)}>
          {challenge.methods.length > 1 ? (
            <div className="mfa-tabs" role="tablist">
              {challenge.methods.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={option === method}
                  className={`btn btn-sm ${option === method ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => onSelect(option)}
                >
                  {t.methods[option]}
                </button>
              ))}
            </div>
          ) : null}
          {method === 'totp' ? <p className="muted">{t.totpHelp}</p> : null}
          {method === 'backup' ? <p className="muted">{t.backupHelp}</p> : null}
          {method === 'email' ? (
            <div className="btn-row" style={{ marginBottom: 12 }}>
              <span className="muted">{t.emailHelp(challenge.emailHint)}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onSendEmail()}>
                {challenge.emailSent ? t.resend : t.send}
              </button>
            </div>
          ) : null}
          {notice ? <p className="notice notice-success">{notice}</p> : null}
          <CodeField
            key={method}
            label={t.methods[method]}
            kind={method === 'backup' ? 'backup' : 'numeric'}
            value={code}
            onChange={setCode}
            autoFocus
          />
          {error ? <p className="notice notice-error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={pending || !complete} style={{ width: '100%' }}>
            {pending ? t.verifying : t.verify}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
