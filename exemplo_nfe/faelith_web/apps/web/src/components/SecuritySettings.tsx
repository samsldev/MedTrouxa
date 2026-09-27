/**
 * @fileoverview Settings card for two-factor authentication (app, email, backup codes).
 * @author Samuel S. L.
 * @version 1.2.0
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
 * - Authenticator enrollment shows a server-rendered QR plus the manual secret
 * - Email 2FA is enabled with an emailed step-up code that proves inbox control
 * - Once any factor is on, disabling or regenerating asks for a second-factor proof first
 * - Newly issued backup codes are shown once, with copy and download
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useEffect, useState, type FormEvent } from 'react';
import {
  ApiError,
  disableEmailMfa,
  disableTotp,
  enableEmailMfa,
  enableTotp,
  fetchSecurity,
  regenerateBackupCodes,
  sendStepUpEmail,
  setupTotp,
} from '../lib/api';
import { useT, type Dict } from '../lib/i18n';
import type { MfaMethod, MfaProof, SecurityStatus, TotpSetup } from '../lib/types';
import { CodeField } from './CodeField';

/** Sensitive changes that need a proof when 2FA is already on. */
type GuardedAction = 'enable-totp' | 'disable-totp' | 'disable-email' | 'regenerate';

interface SecurityStrings {
  actions: Record<GuardedAction, string>;
  methods: Record<MfaMethod, string>;
  fileTitle: string;
  fileHelp: string;
  loadFailed: string;
  requestFailed: string;
  totpOn: string;
  totpOff: string;
  emailOff: string;
  regenerated: string;
  emailed: string;
  emailOn: string;
  title: string;
  loading: string;
  mfaOn: string;
  mfaOff: string;
  saveNow: string;
  saveHelp: string;
  download: string;
  copy: string;
  saved: string;
  appTitle: string;
  appHelp: string;
  disable: string;
  setUp: string;
  qrAlt: string;
  scan: string;
  cantScan: string;
  enterCode: string;
  codeFromApp: string;
  verifyEnable: string;
  cancel: string;
  emailTitle: string;
  emailHelp: string;
  enable: string;
  codeEmailed: string;
  backupTitle: string;
  unused: (count: number) => string;
  generate: string;
  confirmIt: string;
  confirmHelp: string;
  emailMe: string;
  code: string;
}

const T: Dict<SecurityStrings> = {
  en: {
    actions: {
      'enable-totp': 'Confirm and enable authenticator',
      'disable-totp': 'Confirm and disable authenticator',
      'disable-email': 'Confirm and disable email codes',
      regenerate: 'Confirm and generate new codes',
    },
    methods: { totp: 'Authenticator app', email: 'Email code', backup: 'Backup code' },
    fileTitle: 'Faelith backup codes',
    fileHelp: 'Each code can be used once to sign in if you lose your second factor.',
    loadFailed: 'Unable to load security settings',
    requestFailed: 'Request failed',
    totpOn: 'Authenticator app enabled.',
    totpOff: 'Authenticator app disabled.',
    emailOff: 'Email codes disabled.',
    regenerated: 'New backup codes generated. The old ones no longer work.',
    emailed: 'We emailed you a 6-digit code.',
    emailOn: 'Email codes enabled.',
    title: 'Two-factor authentication',
    loading: 'Loading…',
    mfaOn: 'Signing in requires your password and a second factor.',
    mfaOff: 'Add a second factor so a leaked password is not enough to get into your account.',
    saveNow: 'Save your backup codes now.',
    saveHelp: 'They will not be shown again. Each one signs you in once if you lose your phone or email access.',
    download: 'Download .txt',
    copy: 'Copy',
    saved: 'I saved them',
    appTitle: 'Authenticator app',
    appHelp: 'Google Authenticator, 1Password, Authy, Microsoft Authenticator…',
    disable: 'Disable',
    setUp: 'Set up',
    qrAlt: 'QR code for your authenticator app',
    scan: '1. Scan the QR code with your authenticator app.',
    cantScan: "Can't scan? Enter this key manually:",
    enterCode: '2. Enter the 6-digit code the app shows.',
    codeFromApp: 'Code from the app',
    verifyEnable: 'Verify and enable',
    cancel: 'Cancel',
    emailTitle: 'Email codes',
    emailHelp: 'Receive a 6-digit sign-in code by email.',
    enable: 'Enable',
    codeEmailed: 'Code we emailed you',
    backupTitle: 'Backup codes',
    unused: (count) => `${count} of 12 unused.`,
    generate: 'Generate new codes',
    confirmIt: 'Confirm it is you.',
    confirmHelp: 'Enter a code from one of your second factors.',
    emailMe: 'Email me a code',
    code: 'Code',
  },
  br: {
    actions: {
      'enable-totp': 'Confirmar e ativar o autenticador',
      'disable-totp': 'Confirmar e desativar o autenticador',
      'disable-email': 'Confirmar e desativar códigos por e-mail',
      regenerate: 'Confirmar e gerar novos códigos',
    },
    methods: { totp: 'App autenticador', email: 'Código por e-mail', backup: 'Código de backup' },
    fileTitle: 'Códigos de backup do Faelith',
    fileHelp: 'Cada código pode ser usado uma vez para entrar se você perder seu segundo fator.',
    loadFailed: 'Não foi possível carregar as configurações de segurança',
    requestFailed: 'A requisição falhou',
    totpOn: 'App autenticador ativado.',
    totpOff: 'App autenticador desativado.',
    emailOff: 'Códigos por e-mail desativados.',
    regenerated: 'Novos códigos de backup gerados. Os antigos não funcionam mais.',
    emailed: 'Enviamos um código de 6 dígitos para o seu e-mail.',
    emailOn: 'Códigos por e-mail ativados.',
    title: 'Autenticação em dois fatores',
    loading: 'Carregando…',
    mfaOn: 'Para entrar, é preciso sua senha e um segundo fator.',
    mfaOff: 'Adicione um segundo fator para que uma senha vazada não baste para entrar na sua conta.',
    saveNow: 'Salve seus códigos de backup agora.',
    saveHelp: 'Eles não serão mostrados de novo. Cada um permite entrar uma vez se você perder o acesso ao celular ou ao e-mail.',
    download: 'Baixar .txt',
    copy: 'Copiar',
    saved: 'Já salvei',
    appTitle: 'App autenticador',
    appHelp: 'Google Authenticator, 1Password, Authy, Microsoft Authenticator…',
    disable: 'Desativar',
    setUp: 'Configurar',
    qrAlt: 'QR code para o seu app autenticador',
    scan: '1. Escaneie o QR code com seu app autenticador.',
    cantScan: 'Não consegue escanear? Digite esta chave manualmente:',
    enterCode: '2. Digite o código de 6 dígitos que o app mostra.',
    codeFromApp: 'Código do app',
    verifyEnable: 'Verificar e ativar',
    cancel: 'Cancelar',
    emailTitle: 'Códigos por e-mail',
    emailHelp: 'Receba um código de login de 6 dígitos por e-mail.',
    enable: 'Ativar',
    codeEmailed: 'Código que enviamos por e-mail',
    backupTitle: 'Códigos de backup',
    unused: (count) => `${count} de 12 não usados.`,
    generate: 'Gerar novos códigos',
    confirmIt: 'Confirme que é você.',
    confirmHelp: 'Digite um código de um dos seus segundos fatores.',
    emailMe: 'Enviar um código por e-mail',
    code: 'Código',
  },
  pt: {
    actions: {
      'enable-totp': 'Confirmar e ativar o autenticador',
      'disable-totp': 'Confirmar e desativar o autenticador',
      'disable-email': 'Confirmar e desativar códigos por e-mail',
      regenerate: 'Confirmar e gerar novos códigos',
    },
    methods: { totp: 'Aplicação autenticadora', email: 'Código por e-mail', backup: 'Código de cópia de segurança' },
    fileTitle: 'Códigos de cópia de segurança do Faelith',
    fileHelp: 'Cada código pode ser usado uma vez para iniciar sessão se perder o seu segundo fator.',
    loadFailed: 'Não foi possível carregar as definições de segurança',
    requestFailed: 'O pedido falhou',
    totpOn: 'Aplicação autenticadora ativada.',
    totpOff: 'Aplicação autenticadora desativada.',
    emailOff: 'Códigos por e-mail desativados.',
    regenerated: 'Novos códigos de cópia de segurança gerados. Os antigos deixaram de funcionar.',
    emailed: 'Enviámos-lhe um código de 6 dígitos por e-mail.',
    emailOn: 'Códigos por e-mail ativados.',
    title: 'Autenticação de dois fatores',
    loading: 'A carregar…',
    mfaOn: 'Para iniciar sessão, são necessários a sua palavra-passe e um segundo fator.',
    mfaOff: 'Adicione um segundo fator para que uma palavra-passe divulgada não baste para entrar na sua conta.',
    saveNow: 'Guarde já os seus códigos de cópia de segurança.',
    saveHelp: 'Não voltarão a ser mostrados. Cada um permite iniciar sessão uma vez se perder o acesso ao telemóvel ou ao e-mail.',
    download: 'Transferir .txt',
    copy: 'Copiar',
    saved: 'Já os guardei',
    appTitle: 'Aplicação autenticadora',
    appHelp: 'Google Authenticator, 1Password, Authy, Microsoft Authenticator…',
    disable: 'Desativar',
    setUp: 'Configurar',
    qrAlt: 'Código QR para a sua aplicação autenticadora',
    scan: '1. Leia o código QR com a sua aplicação autenticadora.',
    cantScan: 'Não consegue ler? Introduza esta chave manualmente:',
    enterCode: '2. Introduza o código de 6 dígitos que a aplicação mostra.',
    codeFromApp: 'Código da aplicação',
    verifyEnable: 'Verificar e ativar',
    cancel: 'Cancelar',
    emailTitle: 'Códigos por e-mail',
    emailHelp: 'Receba um código de início de sessão de 6 dígitos por e-mail.',
    enable: 'Ativar',
    codeEmailed: 'Código que enviámos por e-mail',
    backupTitle: 'Códigos de cópia de segurança',
    unused: (count) => `${count} de 12 por usar.`,
    generate: 'Gerar novos códigos',
    confirmIt: 'Confirme que é você.',
    confirmHelp: 'Introduza um código de um dos seus segundos fatores.',
    emailMe: 'Enviar-me um código por e-mail',
    code: 'Código',
  },
};

/**
 * Saves recovery codes as a plain-text file the user can store offline.
 */
function downloadCodes(codes: string[], t: SecurityStrings) {
  const text = [t.fileTitle, t.fileHelp, '', ...codes, ''].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'faelith-backup-codes.txt';
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Two-factor authentication settings card.
 */
export function SecuritySettings() {
  const t = useT(T);
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [appCode, setAppCode] = useState('');
  const [emailStep, setEmailStep] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [guarded, setGuarded] = useState<GuardedAction | null>(null);
  const [proofMethod, setProofMethod] = useState<MfaMethod>('totp');
  const [proofCode, setProofCode] = useState('');
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchSecurity()
      .then(setStatus)
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : t.loadFailed));
  }, []);

  /**
   * Stores a new status and surfaces backup codes if the server just issued them.
   */
  function applyStatus(next: SecurityStatus, message: string) {
    setStatus(next);
    if (next.backupCodes) {
      setFreshCodes(next.backupCodes);
    }
    setNotice(message);
    setError(null);
  }

  /**
   * Runs an API call with shared busy/error handling.
   */
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Methods the user can prove with. With an authenticator app on, emailed
   * codes are refused server-side so a compromised inbox cannot downgrade 2FA.
   */
  function proofMethods(): MfaMethod[] {
    return status?.totpEnabled ? ['totp', 'backup'] : ['email', 'backup'];
  }

  /**
   * Executes a guarded action, asking for proof first when 2FA is on.
   */
  function guard(action: GuardedAction) {
    if (status?.mfaEnabled) {
      setGuarded(action);
      setProofMethod(proofMethods()[0]);
      setProofCode('');
      return;
    }
    void run(() => perform(action, undefined));
  }

  /**
   * Calls the endpoint for a guarded action with an optional proof.
   */
  async function perform(action: GuardedAction, proof: MfaProof | undefined) {
    switch (action) {
      case 'enable-totp':
        applyStatus(await enableTotp(appCode, proof), t.totpOn);
        setSetup(null);
        setAppCode('');
        break;
      case 'disable-totp':
        applyStatus(await disableTotp(proof), t.totpOff);
        break;
      case 'disable-email':
        applyStatus(await disableEmailMfa(proof), t.emailOff);
        break;
      case 'regenerate':
        applyStatus(await regenerateBackupCodes(proof), t.regenerated);
        break;
      default: {
        const _never: never = action;
        return _never;
      }
    }
    setGuarded(null);
    setProofCode('');
  }

  /**
   * Submits the proof panel for the pending guarded action.
   */
  function onProof(event: FormEvent) {
    event.preventDefault();
    if (guarded) {
      void run(() => perform(guarded, { method: proofMethod, code: proofCode }));
    }
  }

  /**
   * Starts authenticator enrollment and shows the QR code.
   */
  function onStartTotp() {
    void run(async () => {
      setSetup(await setupTotp());
      setAppCode('');
    });
  }

  /**
   * Emails a step-up code (used to enable email 2FA or as proof).
   */
  function onSendStepUp(then: () => void) {
    void run(async () => {
      await sendStepUpEmail();
      setNotice(t.emailed);
      then();
    });
  }

  /**
   * Confirms the emailed code to turn on email 2FA.
   */
  function onEnableEmail(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      applyStatus(await enableEmailMfa(emailCode), t.emailOn);
      setEmailStep(false);
      setEmailCode('');
    });
  }

  if (status === null) {
    return (
      <article className="card" style={{ marginTop: 16 }}>
        <h3>{t.title}</h3>
        {error ? <p className="notice notice-error">{error}</p> : <p className="muted">{t.loading}</p>}
      </article>
    );
  }

  return (
    <article className="card" style={{ marginTop: 16 }}>
      <h3>{t.title}</h3>
      <p className="muted">{status.mfaEnabled ? t.mfaOn : t.mfaOff}</p>
      {notice ? <p className="notice notice-success">{notice}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      {freshCodes ? (
        <div>
          <p>
            <strong>{t.saveNow}</strong> {t.saveHelp}
          </p>
          <div className="backup-grid">
            {freshCodes.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadCodes(freshCodes, t)}>
              {t.download}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void navigator.clipboard?.writeText(freshCodes.join('\n'))}
            >
              {t.copy}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setFreshCodes(null)}>
              {t.saved}
            </button>
          </div>
        </div>
      ) : null}

      <div className="status-row">
        <span>
          <strong>{t.appTitle}</strong>
          <br />
          <span className="muted">{t.appHelp}</span>
        </span>
        {status.totpEnabled ? (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => guard('disable-totp')}>
            {t.disable}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || setup !== null} onClick={onStartTotp}>
            {t.setUp}
          </button>
        )}
      </div>
      {setup && !status.totpEnabled ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            guard('enable-totp');
          }}
        >
          <div className="qr-box">
            <img src={setup.qr} alt={t.qrAlt} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <p>{t.scan}</p>
              <p className="muted">{t.cantScan}</p>
              <p className="secret-text">{setup.secret}</p>
              <p>{t.enterCode}</p>
            </div>
          </div>
          <CodeField label={t.codeFromApp} value={appCode} onChange={setAppCode} autoFocus />
          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={busy || appCode.length !== 6}>
              {t.verifyEnable}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setSetup(null)}>
              {t.cancel}
            </button>
          </div>
        </form>
      ) : null}

      <div className="status-row">
        <span>
          <strong>{t.emailTitle}</strong>
          <br />
          <span className="muted">{t.emailHelp}</span>
        </span>
        {status.emailEnabled ? (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => guard('disable-email')}>
            {t.disable}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || emailStep}
            onClick={() => onSendStepUp(() => setEmailStep(true))}
          >
            {t.enable}
          </button>
        )}
      </div>
      {emailStep && !status.emailEnabled ? (
        <form onSubmit={onEnableEmail}>
          <CodeField label={t.codeEmailed} value={emailCode} onChange={setEmailCode} autoFocus />
          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={busy || emailCode.length !== 6}>
              {t.verifyEnable}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEmailStep(false)}>
              {t.cancel}
            </button>
          </div>
        </form>
      ) : null}

      {status.mfaEnabled ? (
        <div className="status-row">
          <span>
            <strong>{t.backupTitle}</strong>
            <br />
            <span className="muted">{t.unused(status.backupCodesRemaining)}</span>
          </span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => guard('regenerate')}>
            {t.generate}
          </button>
        </div>
      ) : null}

      {guarded ? (
        <form onSubmit={onProof} className="card" style={{ marginTop: 12 }}>
          <p>
            <strong>{t.confirmIt}</strong> {t.confirmHelp}
          </p>
          <div className="mfa-tabs">
            {proofMethods().map((method) => (
              <button
                key={method}
                type="button"
                className={`btn btn-sm ${method === proofMethod ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setProofMethod(method);
                  setProofCode('');
                }}
              >
                {t.methods[method]}
              </button>
            ))}
          </div>
          {proofMethod === 'email' ? (
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onSendStepUp(() => undefined)}>
              {t.emailMe}
            </button>
          ) : null}
          <CodeField
            key={proofMethod}
            label={t.code}
            kind={proofMethod === 'backup' ? 'backup' : 'numeric'}
            value={proofCode}
            onChange={setProofCode}
          />
          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={busy || proofCode.length < 6}>
              {t.actions[guarded]}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setGuarded(null)}>
              {t.cancel}
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}
