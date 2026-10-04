import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Icon, Stars } from '../components/Brand';
import Footer from '../components/Footer';
import SiteNav from '../components/SiteNav';
import { StatsStrip, Testimonials, useSocial } from '../components/SocialProof';
import { useReveal } from '../hooks';
import { setPageTag } from '../lib/analytics';
import { RECURSOS } from '../recursos';
import { CONTEUDO } from '../recursosConteudo';

/** Página de um recurso (/recursos/:slug): hero com demo, blocos alternados, prova social, FAQ e CTA. */
export default function RecursoPage() {
  const { slug = '' } = useParams();
  const grupo = RECURSOS.find((g) => g.itens.some((r) => r.slug === slug));
  const recurso = grupo?.itens.find((r) => r.slug === slug);
  const c = CONTEUDO[slug];
  const { stats, items } = useSocial();
  useReveal([slug, stats, items]);

  useEffect(() => {
    if (!recurso) return;
    document.title = `${recurso.titulo} · MedTrouxa`;
    setPageTag(`/recursos/${slug}`, `recurso-${slug}`, `/recursos/${slug}`);
    window.scrollTo(0, 0);
  }, [slug, recurso]);

  if (!grupo || !recurso || !c) return <Navigate to="/" replace />;
  const outros = RECURSOS.flatMap((g) => g.itens).filter((r) => r.slug !== slug && r.pagina).slice(0, 4);
  const cadastro = '/login?mode=register';

  return (
    <div className={`landing recurso-page tom-${grupo.tom}`}>
      <SiteNav />

      <section className="hero rp-hero">
        <div className="aurora" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" />
        <Stars />
        <div className="lp-wrap">
          <span className="rp-badge"><span className="rp-badge-i"><Icon name={grupo.icon} size={13} /></span>{grupo.nome}</span>
          <h1>{c.h1}</h1>
          <p className="lede left">{c.lede}</p>
          <div className="hero-cta left">
            <Link to={cadastro} className="btn btn-foil btn-lg">Comece a usar agora <Icon name="arrow" size={16} /></Link>
            <Link to="/planos-e-precos" className="btn btn-glass btn-lg">Ver planos</Link>
          </div>
          <p className="rp-planos"><Icon name="check" size={14} /> {c.planos}</p>
        </div>
        <div className="lp-wrap rp-demo">
          <span className="rp-demo-tag" aria-hidden="true">Demonstração ↓</span>
          <div className="window">
            <div className="window-bar"><i /><i /><i /><span>medtrouxa.com.br/{c.janela}</span></div>
            {c.demo}
          </div>
        </div>
      </section>

      <StatsStrip stats={stats} />

      <section className="rp-blocos">
        {c.blocos.map((b, i) => (
          <div key={b.titulo} className={`rp-bloco ${i % 2 ? 'rev' : ''}`}>
            <div className="lp-wrap rp-bloco-in">
              <div className="rp-copy" data-reveal>
                <span className="rp-tag">{b.tag}</span>
                <h2>{b.titulo}</h2>
                <p>{b.texto}</p>
              </div>
              <div className="rp-visual" data-reveal style={{ transitionDelay: '90ms' }}>{b.visual}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="lp-section rp-meio">
        <div className="lp-wrap center" data-reveal>
          <h2 className="rp-meio-h">Pronto para estudar com <em>{recurso.titulo}</em>?</h2>
          <Link to={cadastro} className="btn btn-foil btn-lg">{c.cta} <Icon name="arrow" size={16} /></Link>
          <p className="hero-fine">Conta grátis em menos de 1 minuto · 7 dias de garantia nos planos</p>
        </div>
      </section>

      <section id="faq" className="lp-section tinted">
        <div className="lp-wrap faq-layout">
          <div className="section-head" data-reveal>
            <span className="kicker">Dúvidas</span>
            <h2>Perguntas <em>frequentes</em></h2>
            <p className="lede left">Sobre {recurso.titulo} no MedTrouxa.</p>
          </div>
          <div className="faq" data-reveal>
            {c.faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </div>
      </section>

      <Testimonials items={items} />

      {outros.length > 0 && (
        <section className="lp-section rp-outros">
          <div className="lp-wrap">
            <div className="section-head center" data-reveal><span className="kicker">Continue explorando</span><h2>Outros <em>recursos</em></h2></div>
            <div className="rp-outros-grid">
              {outros.map((r) => (
                <Link key={r.slug} to={`/recursos/${r.slug}`} className="rp-outro" data-reveal>
                  <span className="feature-icon"><Icon name={r.icon} size={18} /></span>
                  <b>{r.titulo}</b><small>{r.descricao}</small>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="final-cta">
        <div className="aurora" aria-hidden="true" />
        <Stars />
        <div className="grain" aria-hidden="true" />
        <div className="lp-wrap center" data-reveal>
          <h2>A próxima prova começa <em>hoje</em>.</h2>
          <p className="lede">Crie sua conta grátis e teste {recurso.titulo} agora.</p>
          <Link to={cadastro} className="btn btn-foil btn-lg">Criar minha conta <Icon name="arrow" size={16} /></Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
