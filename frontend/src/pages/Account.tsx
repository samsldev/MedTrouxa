import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, session } from '../api/client';
import { useAuth } from '../auth';
import { Icon } from '../components/Brand';

export default function Account() {
  const { user, setUser, logout } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState({ name: user?.name ?? '', university: user?.university ?? '', semester: user?.semester ? String(user.semester) : '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [del, setDel] = useState('');
  const [msg, setMsg] = useState<Record<string, string>>({});
  const say = (k: string, v: string) => setMsg((m) => ({ ...m, [k]: v }));

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    try {
      setUser(await api('/account/profile', { method: 'PATCH', body: {
        name: profile.name, university: profile.university || undefined, semester: profile.semester ? Number(profile.semester) : undefined,
      } }));
      say('profile', 'Dados atualizados.');
    } catch (err) { say('profile', (err as Error).message); }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/account/password', { body: pw });
      setPw({ currentPassword: '', newPassword: '' });
      say('pw', 'Senha alterada. Por segurança, entre novamente.');
      setTimeout(() => { session.set(null); setUser(null); nav('/login'); }, 1500);
    } catch (err) { say('pw', (err as Error).message); }
  }

  async function exportData() {
    try {
      const data = await api('/account/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'medtrouxa-meus-dados.json' });
      a.click(); URL.revokeObjectURL(url);
    } catch (err) { say('export', (err as Error).message); }
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    if (!confirm('Excluir sua conta permanentemente? Esta ação não pode ser desfeita.')) return;
    try { await api('/account', { method: 'DELETE', body: { password: del } }); session.set(null); setUser(null); nav('/'); }
    catch (err) { say('delete', (err as Error).message); }
  }

  return (
    <>
      <div className="page-head"><span className="kicker">Conta</span><h1>Minha <em>conta</em></h1><p className="muted">{user?.email}</p></div>
      <div className="grid2">
        <form className="card stack" onSubmit={saveProfile}>
          <h3>Dados pessoais</h3>
          <label>Nome<input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required minLength={2} maxLength={120} /></label>
          <div className="row">
            <label>Faculdade<input value={profile.university} onChange={(e) => setProfile({ ...profile, university: e.target.value })} maxLength={160} /></label>
            <label className="narrow">Período<input type="number" min={1} max={12} value={profile.semester} onChange={(e) => setProfile({ ...profile, semester: e.target.value })} /></label>
          </div>
          {msg.profile && <p className="muted">{msg.profile}</p>}
          <button className="btn btn-dark">Salvar</button>
        </form>

        <form className="card stack" onSubmit={changePassword}>
          <h3>Trocar senha</h3>
          <label>Senha atual<input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></label>
          <label>Nova senha<input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={8} maxLength={128} /></label>
          {msg.pw && <p className="muted">{msg.pw}</p>}
          <button className="btn btn-dark">Alterar senha</button>
        </form>

        <section className="card stack">
          <h3>Privacidade e dados (LGPD)</h3>
          <p className="muted">Baixe uma cópia de todos os seus dados, ou encerre as sessões em todos os dispositivos.</p>
          <div className="row wrap">
            <button className="btn btn-outline" onClick={exportData}><Icon name="arrow" size={15} /> Exportar meus dados</button>
            <button className="btn btn-outline" onClick={async () => { await api('/auth/logout-all', { method: 'POST' }); await logout(); nav('/login'); }}>Sair de todos os dispositivos</button>
          </div>
          {msg.export && <p className="error">{msg.export}</p>}
        </section>

        <form className="card stack danger-zone" onSubmit={deleteAccount}>
          <h3>Excluir conta</h3>
          <p className="muted">Apaga seu perfil e seu histórico de estudos. Registros de pagamento são mantidos, sem seus dados pessoais, por obrigação fiscal.</p>
          <label>Confirme com sua senha<input type="password" autoComplete="current-password" value={del} onChange={(e) => setDel(e.target.value)} required /></label>
          {msg.delete && <p className="error">{msg.delete}</p>}
          <button className="btn btn-danger">Excluir minha conta</button>
        </form>
      </div>
    </>
  );
}
