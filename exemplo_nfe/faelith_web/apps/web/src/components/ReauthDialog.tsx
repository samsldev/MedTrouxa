/**
 * @fileoverview App-wide "confirm it is you" dialog that answers server reauth challenges.
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
 * - Registers itself as the `request()` reauth prompt; renders nothing until asked
 * - Offers only the methods the server accepts (password, authenticator, email, backup)
 * - Email method sends a step-up code on demand; Escape or Cancel rejects the action
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, sendStepUpEmail, setReauthPrompt } from '../lib/api';
import { useT, type Dict } from '../lib/i18n';
import type { ReauthMethod, ReauthProof, ReauthRequirement } from '../lib/types';
import { CodeField } from './CodeField';
import styles from './ReauthDialog.module.css';

/** Initial server message that is an instruction rather than an error. */
const FIRST_PROMPT = 'confirm it is you to continue';

interface ReauthStrings {
  methods: Record<ReauthMethod, string>;
  sentTo: (hint: string) => string;
  yourEmail: string;
  sendFailed: string;
  title: string;
  lead: string;
  password: string;
  sending: string;
  emailMe: string;
  cancel: string;
  confirm: string;
}

const T: Dict<ReauthStrings> = {
  en: {
    methods: { password: 'Password', totp: 'Authenticator app', email: 'Email code', backup: 'Backup code' },
    sentTo: (hint) => `Code sent to ${hint}.`,
    yourEmail: 'your email',
    sendFailed: 'Could not send the code',
    title: 'Confirm it is you',
    lead: 'This action changes your account, so we need to verify your identity first.',
    password: 'Password',
    sending: 'Sending…',
    emailMe: 'Email me a code',
    cancel: 'Cancel',
    confirm: 'Confirm',
  },
  br: {
    methods: { password: 'Senha', totp: 'App autenticador', email: 'Código por e-mail', backup: 'Código de backup' },
    sentTo: (hint) => `Código enviado para ${hint}.`,
    yourEmail: 'seu e-mail',
    sendFailed: 'Não foi possível enviar o código',
    title: 'Confirme que é você',
    lead: 'Esta ação altera sua conta, então precisamos verificar sua identidade antes.',
    password: 'Senha',
    sending: 'Enviando…',
    emailMe: 'Enviar um código por e-mail',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
  },
  pt: {
    methods: { password: 'Palavra-passe', totp: 'Aplicação autenticadora', email: 'Código por e-mail', backup: 'Código de cópia de segurança' },
    sentTo: (hint) => `Código enviado para ${hint}.`,
    yourEmail: 'o seu e-mail',
    sendFailed: 'Não foi possível enviar o código',
    title: 'Confirme que é você',
    lead: 'Esta ação altera a sua conta, por isso precisamos de verificar a sua identidade primeiro.',
    password: 'Palavra-passe',
    sending: 'A enviar…',
    emailMe: 'Enviar-me um código por e-mail',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
  },
};

type Pending = {
  requirement: ReauthRequirement;
  resolve: (proof: ReauthProof | null) => void;
};

/**
 * Mount once near the root. While a request waits on a challenge, shows a
 * modal and resolves the pending promise with the proof or null on cancel.
 */
export function ReauthDialog() {
  const t = useT(T);
  const [pending, setPending] = useState<Pending | null>(null);
  const [method, setMethod] = useState<ReauthMethod>('password');
  const [code, setCode] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const pendingRef = useRef<Pending | null>(null);

  /** Settles the current prompt exactly once and closes the dialog. */
  const settle = useCallback((proof: ReauthProof | null) => {
    pendingRef.current?.resolve(proof);
    pendingRef.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    setReauthPrompt(
      (requirement) =>
        new Promise<ReauthProof | null>((resolve) => {
          pendingRef.current?.resolve(null);
          const next = { requirement, resolve };
          pendingRef.current = next;
          setPending(next);
          setMethod((current) => (requirement.methods.includes(current) ? current : requirement.methods[0]));
          setCode('');
          setInfo(null);
        }),
    );
    return () => {
      setReauthPrompt(null);
      pendingRef.current?.resolve(null);
      pendingRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') settle(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, settle]);

  if (!pending) {
    return null;
  }
  const { requirement } = pending;
  const failure = requirement.message.toLowerCase() === FIRST_PROMPT ? null : requirement.message;

  /** Emails a step-up code to the account inbox. */
  async function sendCode() {
    setSending(true);
    setInfo(null);
    try {
      await sendStepUpEmail();
      setInfo(t.sentTo(requirement.emailHint || t.yourEmail));
    } catch (caught) {
      setInfo(caught instanceof ApiError ? caught.message : t.sendFailed);
    } finally {
      setSending(false);
    }
  }

  /** Resolves the pending request with the entered proof. */
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (code.trim()) settle({ method, code: code.trim() });
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && settle(null)}>
      <form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="reauth-title" onSubmit={onSubmit}>
        <h3 id="reauth-title">{t.title}</h3>
        <p className={styles.lead}>{t.lead}</p>
        {requirement.methods.length > 1 ? (
          <div className={styles.tabs}>
            {requirement.methods.map((option) => (
              <button
                key={option}
                type="button"
                className={`btn btn-sm ${option === method ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setMethod(option);
                  setCode('');
                  setInfo(null);
                }}
              >
                {t.methods[option]}
              </button>
            ))}
          </div>
        ) : null}
        {method === 'password' ? (
          <label className="field">
            <span>{t.password}</span>
            <input type="password" autoComplete="current-password" value={code} onChange={(event) => setCode(event.target.value)} autoFocus required />
          </label>
        ) : (
          <CodeField
            label={t.methods[method]}
            value={code}
            onChange={setCode}
            kind={method === 'backup' ? 'backup' : 'numeric'}
            autoFocus
          />
        )}
        {method === 'email' ? (
          <button type="button" className="btn btn-ghost btn-sm" disabled={sending} onClick={() => void sendCode()}>
            {sending ? t.sending : t.emailMe}
          </button>
        ) : null}
        {info ? <p className="notice">{info}</p> : null}
        {failure ? <p className="notice notice-error">{failure}</p> : null}
        <div className={styles.actions}>
          <button type="button" className="btn btn-ghost" onClick={() => settle(null)}>
            {t.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!code.trim()}>
            {t.confirm}
          </button>
        </div>
      </form>
    </div>
  );
}
