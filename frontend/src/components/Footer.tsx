import { Link } from 'react-router-dom';
import { resetConsent } from '../lib/analytics';
import { SITE } from '../site';
import { Icon, Logo } from './Brand';

const IG = 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17.5 6.5h.01';
const WA = 'M4 20l1.3-3.9A8 8 0 1 1 8 19zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8a4.5 4.5 0 0 1-2.2-2.2l.8-1-1-2z';

function Social({ href, d, label }: { href: string; d: string; label: string }) {
  return (
    <a className="social" href={href} target="_blank" rel="noreferrer noopener" aria-label={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
    </a>
  );
}

export default function Footer() {
  const wa = SITE.whatsapp ? `https://wa.me/${SITE.whatsapp}` : '';
  const cols: [string, [string, string][]][] = [
    ['Plataforma', [['Questões', '/questoes'], ['Flashcards', '/flashcards'], ['Simulados', '/simulados'], ['Cronogramas', '/cronogramas'], ['Coruja IA', '/coruja']]],
    ['Recursos', [['Planos', '/#planos'], ['Método', '/#metodo'], ['Dúvidas frequentes', '/#faq']]],
    ['Empresa', [
      ...(SITE.email ? [['Contato', `mailto:${SITE.email}`] as [string, string]] : []),
      ...(wa ? [['Falar com suporte', wa] as [string, string]] : []),
      ['Termos de uso', '/termos'], ['Política de privacidade', '/privacidade'],
    ]],
  ];

  return (
    <footer className="site-footer">
      <div className="lp-wrap">
        <div className="footer-top">
          <div className="footer-brand">
            <Logo size={26} />
            <p>A plataforma de estudos para quem leva a medicina a sério — e quer um pouco de magia no caminho.</p>
            <Link to="/login?mode=register" className="btn btn-foil">Começar agora <Icon name="arrow" size={15} /></Link>
          </div>
          {cols.map(([title, links]) => (
            <nav key={title} aria-label={title}>
              <h4>{title}</h4>
              {links.map(([label, href]) => href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('/#')
                ? <a key={label} href={href}>{label}</a>
                : <Link key={label} to={href}>{label}</Link>)}
            </nav>
          ))}
        </div>
        <div className="footer-bottom">
          <div className="socials">
            {SITE.instagram && <Social href={`https://instagram.com/${SITE.instagram}`} d={IG} label="Instagram" />}
            {wa && <Social href={wa} d={WA} label="WhatsApp" />}
          </div>
          <small>
            {SITE.legalName && <>{SITE.legalName} · </>}
            {SITE.cnpj && <>CNPJ {SITE.cnpj} · </>}
            © {new Date().getFullYear()} {SITE.name} · Conteúdo educacional; não substitui avaliação médica.
          </small>
          <button className="to-top" onClick={resetConsent} style={{ minWidth: 0 }}>Preferências de cookies</button>
          <button className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Voltar ao topo <span aria-hidden="true">↑</span></button>
        </div>
      </div>
    </footer>
  );
}
