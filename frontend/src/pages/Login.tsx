import { FormEvent, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { Icon, Logo, Stars } from '../components/Brand';

export default function Login() {
  const { user, login, register } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/inicio';
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ name: '', email: '', password: '', university: '', semester: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={next.startsWith('/') ? next : '/inicio'} replace />;

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
      <aside className="auth-art">
        <Stars />
        <Link to="/"><Logo /></Link>
        <blockquote>
          “Não é mágica. É <em>método</em>,<br />repetido todos os dias.”
        </blockquote>
        <ul>
          <li><Icon name="questions" size={16} /> Questões comentadas</li>
          <li><Icon name="cards" size={16} /> Flashcards com repetição espaçada</li>
          <li><Icon name="owl" size={16} /> Coruja, a tutora com IA</li>
        </ul>
      </aside>
      <main className="auth-main">
        <form className="auth-card" onSubmit={submit}>
          <h1>{mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h1>
          <p className="muted">{mode === 'login' ? 'Continue de onde parou.' : 'Leva menos de um minuto.'}</p>
          {mode === 'register' && <label>Nome<input autoComplete="name" value={form.name} onChange={set('name')} required /></label>}
          <label>E-mail<input type="email" autoComplete="email" value={form.email} onChange={set('email')} required /></label>
          <label>Senha<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} required minLength={6} /></label>
          {mode === 'register' && (
            <div className="row">
              <label>Faculdade<input value={form.university} onChange={set('university')} /></label>
              <label className="narrow">Período<input type="number" min={1} max={12} value={form.semester} onChange={set('semester')} /></label>
            </div>
          )}
          {error && <div className="error">{error}</div>}
          <button className="btn btn-dark btn-block btn-lg" disabled={busy}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
          <button type="button" className="btn btn-text" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
          </button>
        </form>
      </main>
    </div>
  );
}
