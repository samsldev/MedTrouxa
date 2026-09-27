import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Logo } from '../components/Brand';

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="auth-page single">
      <main className="auth-main">
        <div className="auth-card">
          <Link to="/" className="auth-logo"><Logo /></Link>
          <h1>{title}</h1>
          <p className="muted">{sub}</p>
          {children}
        </div>
      </main>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try { setSent((await api<{ message: string }>('/auth/forgot', { body: { email } })).message); }
    catch (err) { setSent((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <Shell title="Esqueceu a senha?" sub="Enviaremos um link para você criar uma nova.">
      {sent ? <div className="notice">{sent}</div> : (
        <form onSubmit={submit} className="stack">
          <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <button className="btn btn-dark btn-block btn-lg" disabled={busy}>Enviar link</button>
        </form>
      )}
      <Link to="/login" className="btn btn-text">← Voltar ao login</Link>
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get('token') ?? '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    if (pw !== pw2) { setError('As senhas não coincidem'); return; }
    setBusy(true);
    try { await api('/auth/reset', { body: { token, password: pw } }); nav('/login?reset=1'); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <Shell title="Nova senha" sub="Por segurança, todas as suas sessões serão encerradas.">
      <form onSubmit={submit} className="stack">
        <label>Nova senha<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} maxLength={128} />
          <small className="hint">Mínimo de 8 caracteres, com letras e números.</small></label>
        <label>Confirme a senha<input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn btn-dark btn-block btn-lg" disabled={busy || !token}>Salvar nova senha</button>
      </form>
    </Shell>
  );
}
