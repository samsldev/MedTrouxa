import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';
import { AuthStep, useAuth } from '../auth';
import { Icon } from './Brand';
import OtpInput from './OtpInput';

type Step = Exclude<AuthStep, { status: 'ok' }>;

/** Etapa de verificação após a senha: código do e-mail (cadastro/2FA por e-mail), app autenticador ou código de recuperação. */
export default function VerifyStep({ step, onStep, onCancel }: { step: Step; onStep(s: AuthStep): void; onCancel(): void }) {
  const { verifyEmail, mfa } = useAuth();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(step.status === 'mfa' && step.method === 'totp' ? 0 : 60);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const isEmailCode = step.status === 'verify_email' || (step.status === 'mfa' && step.method === 'email');

  async function submit(value = code, e?: FormEvent) {
    e?.preventDefault();
    setError(''); setBusy(true);
    try {
      const next = step.status === 'verify_email'
        ? await verifyEmail(step.challenge, value)
        : await mfa(step.challenge, useRecovery ? 'recovery' : step.method, useRecovery ? recovery : value);
      onStep(next);
    } catch (err) {
      setError((err as Error).message); setCode('');
      if (/expirada|Comece novamente/i.test((err as Error).message)) setTimeout(onCancel, 2200);
    } finally { setBusy(false); }
  }

  async function resend() {
    setError('');
    try { await api('/auth/resend-code', { body: { challenge: step.challenge } }); setCooldown(60); }
    catch (err) { setError((err as Error).message); }
  }

  const title = step.status === 'verify_email' ? 'Confirme seu e-mail' : 'Verificação em duas etapas';
  const lead = step.status === 'verify_email'
    ? <>Enviamos um código de 6 dígitos para <b>{step.email}</b>.</>
    : useRecovery ? <>Digite um dos seus códigos de recuperação.</>
      : step.method === 'totp' ? <>Abra seu app autenticador e digite o código do <b>MedTrouxa</b>.</>
        : <>Enviamos um código de 6 dígitos para <b>{step.email}</b>.</>;

  return (
    <form className="verify-step" onSubmit={(e) => submit(code, e)}>
      <span className="verify-icon"><Icon name={step.status === 'verify_email' || step.method === 'email' ? 'spark' : 'shield'} size={24} /></span>
      <h1>{title}</h1>
      <p className="muted">{lead}</p>

      {useRecovery ? (
        <input className="recovery-input" value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder="xxxx-xxxx" autoFocus
          autoComplete="off" spellCheck={false} maxLength={12} aria-label="Código de recuperação" />
      ) : (
        <OtpInput value={code} onChange={setCode} onComplete={(v) => submit(v)} disabled={busy} />
      )}

      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn btn-dark btn-block btn-lg" disabled={busy || (useRecovery ? recovery.length < 8 : code.length !== 6)}>
        {busy ? 'Verificando...' : 'Continuar'}
      </button>

      <div className="verify-links">
        {isEmailCode && !useRecovery && (
          <button type="button" className="btn btn-text" onClick={resend} disabled={cooldown > 0}>
            {cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'}
          </button>
        )}
        {step.status === 'mfa' && (
          <button type="button" className="btn btn-text" onClick={() => { setUseRecovery(!useRecovery); setError(''); }}>
            {useRecovery ? (step.method === 'totp' ? 'Usar o app autenticador' : 'Usar código do e-mail') : 'Usar um código de recuperação'}
          </button>
        )}
        <button type="button" className="btn btn-text" onClick={onCancel}>← Voltar</button>
      </div>
      {isEmailCode && <p className="fine center">Não achou? Confira a caixa de spam ou promoções.</p>}
    </form>
  );
}
