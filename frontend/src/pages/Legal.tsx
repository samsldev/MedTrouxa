import { Link } from 'react-router-dom';
import { Logo } from '../components/Brand';
import Footer from '../components/Footer';

const DOCS = {
  termos: { title: 'Termos de uso', kicker: 'Jurídico' },
  privacidade: { title: 'Política de privacidade', kicker: 'LGPD' },
};

export default function Legal({ doc }: { doc: keyof typeof DOCS }) {
  const d = DOCS[doc];
  return (
    <div className="legal-page">
      <header className="checkout-top"><Link to="/"><Logo /></Link><Link to="/" className="btn btn-text">← Voltar ao início</Link></header>
      <main className="lp-wrap narrow legal">
        <span className="kicker">{d.kicker}</span>
        <h1>{d.title}</h1>
        <p className="muted">Este documento está em preparação e será publicado aqui antes do lançamento comercial da plataforma.</p>
      </main>
      <Footer />
    </div>
  );
}
