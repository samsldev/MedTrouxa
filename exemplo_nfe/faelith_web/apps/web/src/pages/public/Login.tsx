/**
 * @fileoverview Public login page rendered inside the split AuthShell.
 * @author Samuel S. L.
 * @version 2.4.0
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
 * - Email and password sign-in with API error surfacing
 * - Redirects authenticated sessions straight to /app
 * - Accounts with 2FA continue to /login/mfa, preserving the `next` target
 * - OAuth entry points live in AuthShell; OAuth failures arrive as ?error=<code>
 * - Links to the password reset flow
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../../components/AuthShell';
import { ApiError, login } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { useT, type Dict } from '../../lib/i18n';
import { safeNextPath } from '../../lib/nextPath';

interface LoginStrings {
  oauthErrors: Record<string, string>;
  failed: string;
  kicker: string;
  title: [string, string];
  noAccount: string;
  createOne: string;
  email: string;
  password: string;
  passwordPlaceholder: string;
  signingIn: string;
  signIn: string;
  forgot: string;
}

const T: Dict<LoginStrings> = {
  en: {
    oauthErrors: {
      oauth: 'Sign-in with that provider failed. Try again.',
      oauth_link: 'An account with this email already exists. Sign in with your password, then link the provider from Settings.',
      oauth_taken: 'That provider account is already linked to a different Faelith account.',
    },
    failed: 'Login failed',
    kicker: 'Account',
    title: ['Back to ', 'work.'],
    noAccount: 'No account?',
    createOne: 'Create one',
    email: 'Email',
    password: 'Password',
    passwordPlaceholder: 'At least 10 characters',
    signingIn: 'Signing in…',
    signIn: 'Sign in',
    forgot: 'Forgot your password?',
  },
  br: {
    oauthErrors: {
      oauth: 'O login com esse provedor falhou. Tente de novo.',
      oauth_link: 'Já existe uma conta com esse e-mail. Entre com sua senha e depois vincule o provedor nas Configurações.',
      oauth_taken: 'Essa conta do provedor já está vinculada a outra conta Faelith.',
    },
    failed: 'Não foi possível entrar',
    kicker: 'Conta',
    title: ['De volta ao ', 'trabalho.'],
    noAccount: 'Não tem conta?',
    createOne: 'Crie uma',
    email: 'E-mail',
    password: 'Senha',
    passwordPlaceholder: 'Pelo menos 10 caracteres',
    signingIn: 'Entrando…',
    signIn: 'Entrar',
    forgot: 'Esqueceu a senha?',
  },
  pt: {
    oauthErrors: {
      oauth: 'O início de sessão com esse fornecedor falhou. Tente novamente.',
      oauth_link: 'Já existe uma conta com este e-mail. Inicie sessão com a sua palavra-passe e depois associe o fornecedor nas Definições.',
      oauth_taken: 'Essa conta do fornecedor já está associada a outra conta Faelith.',
    },
    failed: 'Não foi possível iniciar sessão',
    kicker: 'Conta',
    title: ['De volta ao ', 'trabalho.'],
    noAccount: 'Não tem conta?',
    createOne: 'Crie uma',
    email: 'E-mail',
    password: 'Palavra-passe',
    passwordPlaceholder: 'Pelo menos 10 caracteres',
    signingIn: 'A iniciar sessão…',
    signIn: 'Iniciar sessão',
    forgot: 'Esqueceu-se da palavra-passe?',
  },
};

/**
 * Public login page.
 */
export function LoginPage() {
  const t = useT(T);
  const { user, setUser, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() => t.oauthErrors[params.get('error') ?? ''] ?? null);
  const [pending, setPending] = useState(false);

  if (user) {
    return <Navigate to={next} replace />;
  }

  /**
   * Authenticates with email and password, then hydrates session state.
   */
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await login(email, password);
      if (result.kind === 'mfa') {
        navigate(`/login/mfa?next=${encodeURIComponent(next)}`);
        return;
      }
      if (result.user) {
        setUser(result.user);
      } else {
        await refresh();
      }
      navigate(next);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      kicker={t.kicker}
      title={
        <>
          {t.title[0]}<span className="serif">{t.title[1]}</span>
        </>
      }
      footer={
        <>
          {t.noAccount} <Link to={next === '/app' ? '/signup' : `/signup?next=${encodeURIComponent(next)}`}>{t.createOne}</Link>
        </>
      }
    >
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
        <label className="field">
          <span>{t.password}</span>
          <input
            type="password"
            autoComplete="current-password"
            placeholder={t.passwordPlaceholder}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={10}
          />
        </label>
        {error ? <p className="notice notice-error">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: '100%' }}>
          {pending ? t.signingIn : t.signIn}
        </button>
        <p style={{ marginTop: 12, textAlign: 'center' }}>
          <Link to="/forgot-password">{t.forgot}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
