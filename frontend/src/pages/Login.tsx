import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', university: '', semester: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register({
        name: form.name, email: form.email, password: form.password,
        university: form.university || undefined, semester: form.semester ? Number(form.semester) : undefined,
      });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <h1 className="brand big">⚡ Med<span>Trouxa</span></h1>
        <p className="muted">Questões comentadas, flashcards com repetição espaçada, simulados e cronogramas — da faculdade ao ENAMED e à residência.</p>
        {mode === 'register' && <input placeholder="Nome" value={form.name} onChange={set('name')} required />}
        <input type="email" placeholder="E-mail" value={form.email} onChange={set('email')} required />
        <input type="password" placeholder="Senha" value={form.password} onChange={set('password')} required minLength={6} />
        {mode === 'register' && (
          <div className="row">
            <input placeholder="Faculdade" value={form.university} onChange={set('university')} />
            <input type="number" min={1} max={12} placeholder="Período" value={form.semester} onChange={set('semester')} />
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </div>
  );
}
