import { Link } from 'react-router-dom';
import { useScrolled } from '../hooks';
import { Logo } from './Brand';

/** Cabeçalho público (landing e página de planos). Âncoras apontam para a landing a partir de qualquer página. */
export default function SiteNav({ active }: { active?: 'planos' }) {
  const scrolled = useScrolled();
  return (
    <header className={`lp-nav ${scrolled || active ? "scrolled" : ""}`}>
      <div className="lp-wrap lp-nav-in">
        <Link to="/" aria-label="MedTrouxa, início"><Logo /></Link>
        <nav>
          <a href="/#recursos">Recursos</a>
          <a href="/#metodo">Método</a>
          <Link to="/planos-e-precos" className={active === 'planos' ? 'active' : ''} aria-current={active === 'planos' ? 'page' : undefined}>Planos</Link>
          <a href="/#faq">Dúvidas</a>
        </nav>
        <div className="lp-nav-cta">
          <Link to="/login" className="btn btn-text">Entrar</Link>
          <Link to="/login?mode=register" className="btn btn-foil">Começar</Link>
        </div>
      </div>
    </header>
  );
}
