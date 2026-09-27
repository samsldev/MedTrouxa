import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Logo } from '../components/Brand';
import Footer from '../components/Footer';
import { SITE } from '../site';

interface Doc { title: string; kicker: string; version: string; sections: [string, string][] }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal-page">
      <header className="checkout-top"><Link to="/"><Logo /></Link><Link to="/" className="btn btn-text">← Voltar ao início</Link></header>
      <main className="lp-wrap narrow legal">{children}</main>
      <Footer />
    </div>
  );
}

/** Termos e privacidade: texto servido pela API (mesma fonte dos apps). */
export default function Legal({ doc }: { doc: 'termos' | 'privacidade' }) {
  const [d, setD] = useState<Doc | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setD(null); api<Doc>(`/legal/${doc}`).then(setD).catch((e) => setError((e as Error).message)); }, [doc]);
  return (
    <Shell>
      {!d ? <p className="muted">{error || 'Carregando…'}</p> : (
        <>
          <span className="kicker">{d.kicker}</span>
          <h1>{d.title}</h1>
          <p className="muted">Versão {d.version}.</p>
          {d.sections.map(([h, t]) => <section key={h}><h2>{h}</h2><p>{t}</p></section>)}
        </>
      )}
    </Shell>
  );
}

/** Página pública de exclusão de conta (exigida pelo Google Play: acessível sem o app). */
export function DeleteAccountInfo() {
  return (
    <Shell>
      <span className="kicker">LGPD</span>
      <h1>Excluir sua conta</h1>
      <section>
        <h2>Pelo app ou pelo site</h2>
        <p>Entre na sua conta e abra <b>Minha conta → Excluir conta</b>. Confirme com a sua senha: a exclusão é imediata.
          No app MedTrouxa (Android e iOS) o caminho é <b>Mais → Minha conta → Excluir minha conta</b>.</p>
        <p><Link to="/login" className="btn btn-dark">Entrar para excluir</Link></p>
      </section>
      <section>
        <h2>O que é apagado</h2>
        <p>Perfil (nome, e-mail, faculdade, período), senha, verificação em duas etapas, questões respondidas, flashcards, simulados, cronogramas e pontuação no ranking.</p>
        <h2>O que é mantido</h2>
        <p>Registros de pagamento e notas fiscais, desvinculados dos seus dados pessoais, pelo prazo exigido pela legislação fiscal (em geral 5 anos).</p>
      </section>
      <section>
        <h2>Sem acesso à conta?</h2>
        <p>Peça a exclusão {SITE.email ? <>pelo e-mail <a href={`mailto:${SITE.email}?subject=Excluir%20minha%20conta`}>{SITE.email}</a></> : 'pelo contato de suporte'}, a partir do e-mail cadastrado. Respondemos em até 15 dias.</p>
      </section>
    </Shell>
  );
}
