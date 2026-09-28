import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { hrefRecurso, RECURSOS } from '../recursos';
import { useScrolled } from '../hooks';
import { Icon, Logo } from './Brand';

/** Cabeçalho público (landing e página de planos). Âncoras apontam para a landing a partir de qualquer página. */
export default function SiteNav({ active }: { active?: 'planos' }) {
  const scrolled = useScrolled();
  return (
    <header className={`lp-nav ${scrolled || active ? "scrolled" : ""}`}>
      <div className="lp-wrap lp-nav-in">
        <Link to="/" aria-label="MedTrouxa, início"><Logo /></Link>
        <nav>
          <RecursosMenu />
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

/** Mega menu "Recursos": abre no hover (desktop), no clique/toque e no teclado; fecha com Esc ou ao sair. */
function RecursosMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);
  const enter = () => { window.clearTimeout(timer.current); setOpen(true); };
  const leave = () => { timer.current = window.setTimeout(() => setOpen(false), 140); };

  return (
    <div className={`mega ${open ? 'open' : ''}`} ref={ref} onMouseEnter={enter} onMouseLeave={leave}
      onBlur={(e) => !ref.current?.contains(e.relatedTarget as Node) && setOpen(false)}>
      <button type="button" className="mega-trigger" aria-expanded={open} aria-controls="mega-recursos" onClick={() => setOpen((o) => !o)}>
        Recursos <Icon name="chevron" size={14} />
      </button>
      <div className="mega-panel" id="mega-recursos" role="region" aria-label="Recursos" hidden={!open}>
        {RECURSOS.map((g) => (
          <div key={g.id} className="mega-col">
            <h4 className={`mega-head ${g.tom}`}><span><Icon name={g.icon} size={14} /></span>{g.nome}</h4>
            {g.itens.map((r) => (
              <a key={r.slug} href={hrefRecurso(r)} className="mega-item" onClick={() => setOpen(false)}>
                <span className="mega-ico"><Icon name={r.icon} size={18} /></span>
                <span><b>{r.titulo}</b><small>{r.descricao}</small></span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
