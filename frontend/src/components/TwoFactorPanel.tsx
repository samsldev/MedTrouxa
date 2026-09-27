import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Icon } from './Brand';
import OtpInput from './OtpInput';

interface Security { emailVerified: boolean; twoFactorMethod: 'totp' | 'email' | null; twoFactorEnabledAt: string | null; recoveryCodesLeft: number }
type Flow =
  | { kind: 'idle' }
  | { kind: 'totp'; qr: string; secret: string }
  | { kind: 'email'; challenge: string }
  | { kind: 'codes'; codes: string[] }
  | { kind: 'confirm'; action: 'disable' | 'regenerate'; challenge?: string };

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone(): void }) {
  const [saved, setSaved] = useState(false);
  const text = `MedTrouxa — códigos de recuperação\nGerados em ${new Date().toLocaleString('pt-BR')}\nCada código pode ser usado uma única vez.\n\n${codes.join('\n')}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    Object.assign(document.createElement('a'), { href: url, download: 'medtrouxa-codigos-de-recuperacao.txt' }).click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="stack">
      <div className="notice"><Icon name="shield" size={16} /><span>Guarde estes códigos em local seguro. Eles são a única forma de entrar se você perder o acesso ao seu segundo fator, e <b>não serão mostrados de novo</b>.</span></div>
      <ol className="codes">{codes.map((c) => <li key={c}><code>{c}</code></li>)}</ol>
      <div className="row wrap">
        <button type="button" className="btn btn-outline" onClick={() => navigator.clipboard.writeText(codes.join('\n'))}>Copiar</button>
        <button type="button" className="btn btn-outline" onClick={download}>Baixar .txt</button>
      </div>
      <label className="check"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /><span>Guardei meus códigos de recuperação em local seguro.</span></label>
      <button type="button" className="btn btn-dark" disabled={!saved} onClick={onDone}>Concluir</button>
    </div>
  );
}

export default function TwoFactorPanel() {
  const [sec, setSec] = useState<Security | null>(null);
  const [flow, setFlow] = useState<Flow>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api<Security>('/account/security').then(setSec);
  useEffect(() => { load(); }, []);
  const reset = (f: Flow = { kind: 'idle' }) => { setFlow(f); setCode(''); setPassword(''); setError(''); setUseRecovery(false); };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); setCode(''); } finally { setBusy(false); }
  };

  const startTotp = () => run(async () => reset({ kind: 'totp', ...(await api<{ qr: string; secret: string }>('/account/2fa/totp/setup', { method: 'POST' })) }));
  const startEmail = () => run(async () => reset({ kind: 'email', ...(await api<{ challenge: string }>('/account/2fa/email/setup', { method: 'POST' })) }));

  const enable = (value = code) => run(async () => {
    const r = flow.kind === 'totp'
      ? await api<{ recoveryCodes: string[] }>('/account/2fa/totp/enable', { body: { code: value } })
      : await api<{ recoveryCodes: string[] }>('/account/2fa/email/enable', { body: { challenge: (flow as { challenge: string }).challenge, code: value } });
    reset({ kind: 'codes', codes: r.recoveryCodes }); load();
  });

  const startConfirm = (action: 'disable' | 'regenerate') => run(async () => {
    const challenge = sec?.twoFactorMethod === 'email'
      ? (await api<{ challenge: string }>('/account/2fa/confirm-code', { method: 'POST' })).challenge : undefined;
    reset({ kind: 'confirm', action, challenge });
  });

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (flow.kind !== 'confirm') return;
    await run(async () => {
      const body = { password, code, method: useRecovery ? 'recovery' : sec!.twoFactorMethod, challenge: flow.challenge };
      if (flow.action === 'disable') { await api('/account/2fa/disable', { body }); reset(); }
      else reset({ kind: 'codes', codes: (await api<{ recoveryCodes: string[] }>('/account/2fa/recovery-codes', { body })).recoveryCodes });
      load();
    });
  }

  if (!sec) return <section className="card"><h3>Verificação em duas etapas</h3><p className="muted">Carregando...</p></section>;

  return (
    <section className="card stack tfa">
      <div className="tfa-head">
        <span className={`tfa-badge ${sec.twoFactorMethod ? 'on' : ''}`}><Icon name={sec.twoFactorMethod ? 'shield' : 'lock'} size={18} /></span>
        <div>
          <h3>Verificação em duas etapas</h3>
          <p className="muted">
            {sec.twoFactorMethod
              ? <>Ativada via <b>{sec.twoFactorMethod === 'totp' ? 'app autenticador' : 'e-mail'}</b>{sec.twoFactorEnabledAt && <> desde {new Date(sec.twoFactorEnabledAt).toLocaleDateString('pt-BR')}</>} · {sec.recoveryCodesLeft} códigos de recuperação restantes</>
              : 'Proteja sua conta pedindo um código além da senha ao entrar.'}
          </p>
        </div>
      </div>

      {flow.kind === 'idle' && !sec.twoFactorMethod && (
        <div className="tfa-options">
          <button className="tfa-option" onClick={startTotp} disabled={busy}>
            <Icon name="shield" size={20} />
            <span><b>App autenticador <em className="rec">recomendado</em></b><small>Google Authenticator, Microsoft Authenticator, Authy, 1Password…</small></span>
          </button>
          <button className="tfa-option" onClick={startEmail} disabled={busy}>
            <Icon name="spark" size={20} />
            <span><b>Código por e-mail</b><small>Enviamos um código de 6 dígitos a cada entrada.</small></span>
          </button>
        </div>
      )}

      {flow.kind === 'totp' && (
        <div className="tfa-setup">
          <ol className="tfa-steps">
            <li>Instale um app autenticador no celular.</li>
            <li>Escaneie o QR Code (ou digite a chave manualmente).</li>
            <li>Digite o código de 6 dígitos que aparece no app.</li>
          </ol>
          <div className="qr-wrap">
            <img src={flow.qr} alt="QR Code para configurar o app autenticador" width={200} height={200} />
            <div>
              <small className="muted">Chave manual</small>
              <code className="secret">{flow.secret}</code>
              <button type="button" className="btn btn-text" onClick={() => navigator.clipboard.writeText(flow.secret.replace(/ /g, ''))}>Copiar chave</button>
            </div>
          </div>
          <OtpInput value={code} onChange={setCode} onComplete={enable} disabled={busy} />
          {error && <div className="error" role="alert">{error}</div>}
          <div className="row wrap">
            <button className="btn btn-dark" disabled={busy || code.length !== 6} onClick={() => enable()}>Ativar</button>
            <button className="btn btn-text" onClick={() => reset()}>Cancelar</button>
          </div>
        </div>
      )}

      {flow.kind === 'email' && (
        <div className="stack">
          <p className="muted">Enviamos um código para o seu e-mail. Digite-o para ativar.</p>
          <OtpInput value={code} onChange={setCode} onComplete={enable} disabled={busy} />
          {error && <div className="error" role="alert">{error}</div>}
          <div className="row wrap">
            <button className="btn btn-dark" disabled={busy || code.length !== 6} onClick={() => enable()}>Ativar</button>
            <button className="btn btn-text" onClick={() => reset()}>Cancelar</button>
          </div>
        </div>
      )}

      {flow.kind === 'codes' && <RecoveryCodes codes={flow.codes} onDone={() => reset()} />}

      {flow.kind === 'idle' && sec.twoFactorMethod && (
        <div className="row wrap">
          <button className="btn btn-outline" onClick={() => startConfirm('regenerate')} disabled={busy}>Gerar novos códigos de recuperação</button>
          <button className="btn btn-danger" onClick={() => startConfirm('disable')} disabled={busy}>Desativar</button>
        </div>
      )}

      {flow.kind === 'confirm' && (
        <form className="stack" onSubmit={confirm}>
          <p className="muted">Confirme que é você: {flow.action === 'disable' ? 'desativar a verificação em duas etapas' : 'os códigos atuais deixarão de funcionar'}.</p>
          <label>Senha<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {useRecovery
            ? <label>Código de recuperação<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="xxxx-xxxx" required /></label>
            : <><small className="muted">{sec.twoFactorMethod === 'totp' ? 'Código do app autenticador' : 'Código enviado para o seu e-mail'}</small>
              <OtpInput value={code} onChange={setCode} disabled={busy} autoFocus={false} /></>}
          <button type="button" className="btn btn-text left" onClick={() => { setUseRecovery(!useRecovery); setCode(''); }}>
            {useRecovery ? 'Usar o código normal' : 'Usar um código de recuperação'}
          </button>
          {error && <div className="error" role="alert">{error}</div>}
          <div className="row wrap">
            <button className={flow.action === 'disable' ? 'btn btn-danger' : 'btn btn-dark'} disabled={busy}>{flow.action === 'disable' ? 'Desativar' : 'Gerar novos códigos'}</button>
            <button type="button" className="btn btn-text" onClick={() => reset()}>Cancelar</button>
          </div>
        </form>
      )}
    </section>
  );
}
