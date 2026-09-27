/**
 * @fileoverview Public signup page rendered inside the split AuthShell.
 * @author Samuel S. L.
 * @version 2.3.0
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
 * - Name, email, and password registration with client-side length check
 * - Second step confirms the 6-digit code emailed by the server before the account exists
 * - Redirects authenticated sessions straight to /app
 * - OAuth entry points live in AuthShell
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../../components/AuthShell';
import { CodeField } from '../../components/CodeField';
import { ApiError, resendSignup, signup, verifySignup } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { useT, type Dict } from '../../lib/i18n';
import { safeNextPath } from '../../lib/nextPath';

interface SignupStrings {
  passwordShort: string;
  codeSent: (email: string) => string;
  signupFailed: string;
  verifyFailed: string;
  resent: (email: string) => string;
  resendFailed: string;
  verifyKicker: string;
  verifyTitle: [string, string];
  wrongAddress: string;
  changeEmail: string;
  codeLabel: string;
  verifying: string;
  verify: string;
  resend: string;
  kicker: string;
  title: [string, string];
  haveAccount: string;
  signIn: string;
  name: string;
  email: string;
  password: string;
  passwordPlaceholder: string;
  sendingCode: string;
  create: string;
}

const T: Dict<SignupStrings> = {
  en: {
    passwordShort: 'Password must be at least 10 characters',
    codeSent: (email) => `We sent a 6-digit code to ${email}. It expires in 10 minutes.`,
    signupFailed: 'Signup failed',
    verifyFailed: 'Verification failed',
    resent: (email) => `A new code is on its way to ${email}.`,
    resendFailed: 'Unable to resend the code',
    verifyKicker: 'Verify email',
    verifyTitle: ['Check your ', 'inbox.'],
    wrongAddress: 'Wrong address?',
    changeEmail: 'Change email',
    codeLabel: 'Verification code',
    verifying: 'Verifying…',
    verify: 'Verify and create account',
    resend: 'Resend code',
    kicker: 'Account',
    title: ['Your first commit is ', 'minutes away.'],
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    passwordPlaceholder: 'At least 10 characters',
    sendingCode: 'Sending code…',
    create: 'Create account',
  },
  br: {
    passwordShort: 'A senha precisa ter pelo menos 10 caracteres',
    codeSent: (email) => `Enviamos um código de 6 dígitos para ${email}. Ele expira em 10 minutos.`,
    signupFailed: 'Não foi possível criar a conta',
    verifyFailed: 'Não foi possível verificar o código',
    resent: (email) => `Um novo código está a caminho de ${email}.`,
    resendFailed: 'Não foi possível reenviar o código',
    verifyKicker: 'Verificar e-mail',
    verifyTitle: ['Confira sua ', 'caixa de entrada.'],
    wrongAddress: 'Endereço errado?',
    changeEmail: 'Trocar e-mail',
    codeLabel: 'Código de verificação',
    verifying: 'Verificando…',
    verify: 'Verificar e criar conta',
    resend: 'Reenviar código',
    kicker: 'Conta',
    title: ['Seu primeiro commit está a ', 'minutos daqui.'],
    haveAccount: 'Já tem uma conta?',
    signIn: 'Entrar',
    name: 'Nome',
    email: 'E-mail',
    password: 'Senha',
    passwordPlaceholder: 'Pelo menos 10 caracteres',
    sendingCode: 'Enviando código…',
    create: 'Criar conta',
  },
  pt: {
    passwordShort: 'A palavra-passe tem de ter pelo menos 10 caracteres',
    codeSent: (email) => `Enviámos um código de 6 dígitos para ${email}. Expira em 10 minutos.`,
    signupFailed: 'Não foi possível criar a conta',
    verifyFailed: 'Não foi possível verificar o código',
    resent: (email) => `Está a caminho um novo código para ${email}.`,
    resendFailed: 'Não foi possível reenviar o código',
    verifyKicker: 'Verificar e-mail',
    verifyTitle: ['Consulte a sua ', 'caixa de entrada.'],
    wrongAddress: 'Endereço errado?',
    changeEmail: 'Alterar e-mail',
    codeLabel: 'Código de verificação',
    verifying: 'A verificar…',
    verify: 'Verificar e criar conta',
    resend: 'Reenviar código',
    kicker: 'Conta',
    title: ['O seu primeiro commit está a ', 'minutos de distância.'],
    haveAccount: 'Já tem conta?',
    signIn: 'Iniciar sessão',
    name: 'Nome',
    email: 'E-mail',
    password: 'Palavra-passe',
    passwordPlaceholder: 'Pelo menos 10 caracteres',
    sendingCode: 'A enviar código…',
    create: 'Criar conta',
  },
};

/**
 * Public signup page: account details, then email verification.
 */
export function SignupPage() {
  const t = useT(T);
  const { user, setUser, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user) {
    return <Navigate to={next} replace />;
  }

  /**
   * Submits account details; the server emails a code and nothing is created yet.
   */
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 10) {
      setError(t.passwordShort);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await signup(email, password, name);
      setAwaitingCode(true);
      setNotice(t.codeSent(email));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.signupFailed);
    } finally {
      setPending(false);
    }
  }

  /**
   * Confirms the emailed code, which creates the account and signs in.
   */
  async function onVerify(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const session = await verifySignup(email, code);
      if (session) {
        setUser(session);
      } else {
        await refresh();
      }
      navigate(next);
    } catch (caught) {
      setCode('');
      setError(caught instanceof ApiError ? caught.message : t.verifyFailed);
    } finally {
      setPending(false);
    }
  }

  /**
   * Requests a fresh code (the server enforces a 60 second cooldown).
   */
  async function onResend() {
    setError(null);
    try {
      await resendSignup(email);
      setNotice(t.resent(email));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.resendFailed);
    }
  }

  /**
   * Returns to the details form, e.g. to fix a mistyped email.
   */
  function onEditDetails() {
    setAwaitingCode(false);
    setCode('');
    setNotice(null);
    setError(null);
  }

  const loginLink = next === '/app' ? '/login' : `/login?next=${encodeURIComponent(next)}`;

  if (awaitingCode) {
    return (
      <AuthShell
        kicker={t.verifyKicker}
        showOAuth={false}
        title={
          <>
            {t.verifyTitle[0]}<span className="serif">{t.verifyTitle[1]}</span>
          </>
        }
        footer={
          <>
            {t.wrongAddress}{' '}
            <button type="button" className="link-button" onClick={onEditDetails}>
              {t.changeEmail}
            </button>
          </>
        }
      >
        <form onSubmit={(event) => void onVerify(event)}>
          {notice ? <p className="notice notice-success">{notice}</p> : null}
          <CodeField label={t.codeLabel} value={code} onChange={setCode} autoFocus />
          {error ? <p className="notice notice-error">{error}</p> : null}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={pending || code.length !== 6}
            style={{ width: '100%' }}
          >
            {pending ? t.verifying : t.verify}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void onResend()} style={{ width: '100%', marginTop: 8 }}>
            {t.resend}
          </button>
        </form>
      </AuthShell>
    );
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
          {t.haveAccount} <Link to={loginLink}>{t.signIn}</Link>
        </>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)}>
        <label className="field">
          <span>{t.name}</span>
          <input
            autoComplete="name"
            placeholder="Ada Lovelace"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={100}
          />
        </label>
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
            autoComplete="new-password"
            placeholder={t.passwordPlaceholder}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={10}
          />
        </label>
        {error ? <p className="notice notice-error">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: '100%' }}>
          {pending ? t.sendingCode : t.create}
        </button>
      </form>
    </AuthShell>
  );
}
