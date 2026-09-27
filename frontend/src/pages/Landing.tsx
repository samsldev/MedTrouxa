import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, Logo, Stars } from '../components/Brand';
import Pricing from '../components/Pricing';
import { spotlight, useReveal, useScrolled } from '../hooks';

const TABS = [
  { id: 'questoes', icon: 'questions', label: 'Questões', title: 'Questões comentadas', text: 'Monte listas do seu jeito: área, tema, banca, ano, dificuldade — ou só as que você errou.' },
  { id: 'flashcards', icon: 'cards', label: 'Flashcards', title: 'Flashcards que lembram por você', text: 'Repetição espaçada: cada card volta no dia exato em que você estaria prestes a esquecer.' },
  { id: 'simulados', icon: 'timer', label: 'Simulados', title: 'Simulados com cronômetro', text: 'Treine no ritmo da prova real e receba nota e gabarito comentado ao final.' },
  { id: 'coruja', icon: 'owl', label: 'Coruja IA', title: 'A Coruja, sua tutora com IA', text: 'Explica questões, resume condutas e transforma seus resumos em flashcards.' },
  { id: 'cronogramas', icon: 'calendar', label: 'Cronogramas', title: 'Cronogramas guiados', text: 'Planos dia a dia para ENAMED, residência e internato. É só seguir o mapa.' },
] as const;

const AREAS = ['Clínica Médica', 'Cirurgia', 'Pediatria', 'Ginecologia e Obstetrícia', 'Medicina Preventiva', 'Cardiologia', 'Infectologia', 'Neonatologia', 'Epidemiologia', 'Trauma'];

function Mock({ tab }: { tab: (typeof TABS)[number]['id'] }) {
  if (tab === 'flashcards') {
    return (
      <div className="mock-body center-col">
        <div className="mock-flash">
          <small>Cardiologia · Cardio de bolso</small>
          <p>Tríade de Beck</p>
          <hr />
          <p className="answer">Hipotensão, turgência jugular e abafamento de bulhas — tamponamento cardíaco.</p>
        </div>
        <div className="mock-grades"><span className="g bad">Errei</span><span className="g mid">Difícil</span><span className="g good">Bom · 6 dias</span><span className="g easy">Fácil · 12 dias</span></div>
      </div>
    );
  }
  if (tab === 'simulados') {
    return (
      <div className="mock-body">
        <div className="mock-row"><b>Simulado ENAMED · 40 questões</b><span className="mock-timer">01:24:37</span></div>
        <div className="mock-grid">{Array.from({ length: 40 }, (_, i) => <span key={i} className={i < 23 ? 'done' : i === 23 ? 'now' : ''}>{i + 1}</span>)}</div>
        <div className="mock-row muted-row"><span>23 de 40 respondidas</span><span>Finaliza automaticamente ao fim do tempo</span></div>
      </div>
    );
  }
  if (tab === 'coruja') {
    return (
      <div className="mock-body chatty">
        <div className="mb user">Quais as pegadinhas de prova sobre pré-eclâmpsia?</div>
        <div className="mb bot">
          <b>✦ Resumo de bolso</b><br />
          • Sulfato de magnésio previne e trata a eclâmpsia — antídoto: gluconato de cálcio.<br />
          • Proteinúria não é obrigatória se houver lesão de órgão-alvo.<br />
          • Após 20 semanas; antes disso, pense em mola hidatiforme.
        </div>
      </div>
    );
  }
  if (tab === 'cronogramas') {
    return (
      <div className="mock-body">
        <div className="mock-row"><b>ENAMED em 8 semanas</b><span className="mock-pill">38% concluído</span></div>
        <div className="mock-progress"><div style={{ width: '38%' }} /></div>
        {['Cardiologia: 20 questões', 'Endocrinologia: resumo + flashcards', 'Pneumologia: 20 questões', 'Simulado semanal + revisão dos erros'].map((t, i) => (
          <div key={t} className={`mock-task ${i < 2 ? 'done' : i === 2 ? 'today' : ''}`}>
            <span className="box">{i < 2 && <Icon name="check" size={12} />}</span><small>Dia {19 + i}</small>{t}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mock-body">
      <div className="mock-tags"><span>ENAMED 2025</span><span>Cardiologia</span><span>Média</span></div>
      <p className="mock-q">Paciente de 58 anos com dor torácica há 40 minutos e supradesnivelamento de ST em V1–V4. Sem hemodinâmica disponível; transferência levaria 3 horas. Qual a conduta?</p>
      {[['A', 'Aguardar troponina para confirmar', '4%'], ['B', 'Trombólise em até 30 minutos da chegada', '71%'], ['C', 'Transferir para angioplastia primária', '19%'], ['D', 'Iniciar apenas AAS e observar', '6%']].map(([k, t, p]) => (
        <div key={k} className={`mock-alt ${k === 'B' ? 'right' : ''}`}><b>{k}</b>{t}<small>{p}</small></div>
      ))}
      <div className="mock-comment"><b>Comentário.</b> Sem angioplastia em até 120 minutos, indica-se fibrinólise com porta-agulha ≤ 30 min.</div>
    </div>
  );
}

const FAQ = [
  ['Posso parcelar?', 'Sim. Todos os planos podem ser parcelados em até 12x no cartão, ou pagos à vista no Pix ou no cartão com o preço à vista.'],
  ['Qual a diferença entre Alquimista e Arcano?', 'O conteúdo é o mesmo. O Alquimista é uma assinatura anual; o Arcano é um pagamento único que garante 6 anos de acesso, cobrindo a faculdade inteira sem renovação.'],
  ['Serve para quem está no ciclo básico?', 'Serve. O Aprendiz foi pensado para as provas da graduação, e você pode migrar de plano quando o ENAMED ou a residência chegarem.'],
  ['A Coruja substitui um professor?', 'Ela acelera o estudo: explica questões, resume temas e cria flashcards. É conteúdo educacional e não substitui avaliação médica.'],
  ['Funciona no celular?', 'Sim. A plataforma é responsiva e funciona no navegador do celular, tablet ou computador.'],
];

function Ornament() {
  return <div className="ornament" aria-hidden="true"><span /><Icon name="spark" size={12} /><span /></div>;
}

export default function Landing() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('questoes');
  const current = TABS.find((t) => t.id === tab)!;
  const scrolled = useScrolled();
  useReveal();

  return (
    <div className="landing">
      <header className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="lp-wrap lp-nav-in">
          <Link to="/" aria-label="MedTrouxa, início"><Logo /></Link>
          <nav>
            <a href="#recursos">Recursos</a>
            <a href="#metodo">Método</a>
            <a href="#planos">Planos</a>
            <a href="#faq">Dúvidas</a>
          </nav>
          <div className="lp-nav-cta">
            <Link to="/login" className="btn btn-text">Entrar</Link>
            <Link to="/login?mode=register" className="btn btn-foil">Começar</Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="aurora" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" />
        <Stars />
        <div className="grain" aria-hidden="true" />
        <div className="lp-wrap hero-in">
          <span className="eyebrow"><Icon name="spark" size={13} /> Medicina, com um toque de magia</span>
          <h1>Estude medicina como quem <em>domina um feitiço</em>.</h1>
          <p className="lede">Questões comentadas, flashcards com repetição espaçada, simulados e uma tutora com IA. Da faculdade ao ENAMED e à residência, em um só lugar.</p>
          <div className="hero-cta">
            <Link to="/login?mode=register" className="btn btn-foil btn-lg">Começar agora <Icon name="arrow" size={16} /></Link>
            <a href="#planos" className="btn btn-glass btn-lg">Ver planos</a>
          </div>
          <p className="hero-fine">Em até 12x no cartão · Acesso imediato</p>
        </div>

        <div className="lp-wrap showcase-wrap">
          <div className="tabs" role="tablist" aria-label="Recursos da plataforma">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                <Icon name={t.icon} size={15} /> {t.label}
              </button>
            ))}
          </div>
          <div className="showcase">
            <div className="window">
              <div className="window-bar"><i /><i /><i /><span>medtrouxa.com.br · {current.label}</span></div>
              <Mock key={tab} tab={tab} />
            </div>
            <div className="showcase-caption">
              <span className="cap-icon"><Icon name={current.icon} size={18} /></span>
              <div><b>{current.title}</b><span>{current.text}</span></div>
            </div>
          </div>
        </div>

        <div className="areas" aria-label="Grandes áreas cobertas">
          <div className="areas-track">
            {[...AREAS, ...AREAS].map((a, i) => <span key={i}>{a}<i>✦</i></span>)}
          </div>
        </div>
      </section>

      <section id="recursos" className="lp-section">
        <div className="lp-wrap">
          <div className="section-head" data-reveal>
            <span className="kicker">I · Recursos</span>
            <h2>Tudo que você precisa. <em>Nada que distraia.</em></h2>
            <p className="lede left">Cada ferramenta existe por um motivo: fazer você lembrar mais, em menos tempo.</p>
          </div>

          <div className="bento">
            <article className="tile-b span2" data-reveal onMouseMove={spotlight}>
              <div className="tile-copy">
                <span className="feature-icon"><Icon name="questions" size={19} /></span>
                <h3>Banco de questões comentadas</h3>
                <p>Filtros por área, tema, banca e ano. Após responder, veja o comentário e como a comunidade marcou cada alternativa.</p>
              </div>
              <div className="viz-dist" aria-hidden="true">
                {[['A', 4], ['B', 71], ['C', 19], ['D', 6]].map(([k, v]) => (
                  <div key={k} className={k === 'B' ? 'right' : ''}><b>{k}</b><span><i style={{ width: `${v}%` }} /></span><small>{v}%</small></div>
                ))}
              </div>
            </article>

            <article className="tile-b tall" data-reveal onMouseMove={spotlight}>
              <span className="feature-icon"><Icon name="cards" size={19} /></span>
              <h3>Repetição espaçada</h3>
              <p>O algoritmo decide quando cada card volta. Você só aparece e revisa.</p>
              <svg className="viz-curve" viewBox="0 0 240 120" aria-hidden="true">
                <defs>
                  <linearGradient id="cg" x1="0" x2="1"><stop offset="0" stopColor="var(--arcane)" /><stop offset="1" stopColor="var(--gold)" /></linearGradient>
                </defs>
                <path d="M10 20 C 30 70, 40 80, 55 84 L55 22 C 80 60, 95 68, 110 70 L110 21 C 140 45, 160 52, 180 54 L180 20 C 200 30, 215 34, 232 36" fill="none" stroke="url(#cg)" strokeWidth="2" strokeLinecap="round" />
                {[55, 110, 180].map((x) => <circle key={x} cx={x} cy="21" r="3.5" fill="var(--gold)" />)}
                <line x1="10" y1="104" x2="232" y2="104" stroke="var(--border-strong)" />
                {[['1d', 55], ['6d', 110], ['15d', 180]].map(([t, x]) => <text key={t} x={x} y="117" textAnchor="middle">{t}</text>)}
              </svg>
            </article>

            <article className="tile-b" data-reveal onMouseMove={spotlight}>
              <span className="feature-icon"><Icon name="timer" size={19} /></span>
              <h3>Simulados reais</h3>
              <p>Tempo de prova, finalização automática e nota comentada.</p>
              <div className="viz-timer" aria-hidden="true">01:24:37</div>
            </article>

            <article className="tile-b" data-reveal onMouseMove={spotlight}>
              <span className="feature-icon"><Icon name="owl" size={19} /></span>
              <h3>Coruja IA</h3>
              <p>Explicações sob demanda e flashcards gerados dos seus resumos.</p>
              <div className="viz-chat" aria-hidden="true"><span>Explique a tríade de Beck</span><span>Hipotensão, turgência jugular…</span></div>
            </article>

            <article className="tile-b" data-reveal onMouseMove={spotlight}>
              <span className="feature-icon"><Icon name="calendar" size={19} /></span>
              <h3>Cronogramas</h3>
              <p>Planos dia a dia para ENAMED, residência e internato.</p>
              <div className="viz-days" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} className={i < 9 ? 'on' : i === 9 ? 'now' : ''} />)}</div>
            </article>

            <article className="tile-b span2 dark" data-reveal onMouseMove={spotlight}>
              <div className="tile-copy">
                <span className="feature-icon"><Icon name="trophy" size={19} /></span>
                <h3>Desempenho que você enxerga</h3>
                <p>Aproveitamento por área, sequência de dias e XP. O progresso fica visível — e vicia do jeito certo.</p>
              </div>
              <div className="viz-bars" aria-hidden="true">
                {[38, 52, 47, 61, 58, 70, 66, 78, 74, 83].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="metodo" className="lp-section tinted">
        <div className="lp-wrap">
          <div className="section-head center" data-reveal>
            <span className="kicker">II · Método</span>
            <h2>Três gestos. <em>Repetidos todos os dias.</em></h2>
          </div>
          <ol className="steps">
            {[
              ['Resolva', 'Comece pelas questões. Errar cedo é o jeito mais rápido de descobrir o que cai.'],
              ['Revise', 'Cada erro vira flashcard e volta no momento certo, até virar reflexo.'],
              ['Domine', 'Simulados medem o progresso e o cronograma mostra o próximo passo.'],
            ].map(([t, d], i) => (
              <li key={t} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="step-n">{['I', 'II', 'III'][i]}</span><h3>{t}</h3><p>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="planos" className="lp-section pricing-section">
        <div className="lp-wrap">
          <div className="section-head center" data-reveal>
            <span className="kicker">III · Planos</span>
            <h2>Escolha seu <em>grau de maestria</em>.</h2>
            <p className="lede">Assinaturas anuais em até 12x no cartão, ou à vista no Pix.</p>
          </div>
          <Pricing ctaHref={(id) => `/checkout/${id}`} />
          <Ornament />
          <ul className="guarantees">
            <li><Icon name="shield" size={16} /> Pagamento seguro</li>
            <li><Icon name="spark" size={16} /> Acesso liberado na hora</li>
            <li><Icon name="card" size={16} /> Até 12x no cartão ou Pix</li>
          </ul>
        </div>
      </section>

      <section id="faq" className="lp-section tinted">
        <div className="lp-wrap faq-layout">
          <div className="section-head" data-reveal>
            <span className="kicker">IV · Dúvidas</span>
            <h2>Perguntas <em>frequentes</em></h2>
            <p className="lede left">Não achou o que procurava? Fale com a gente pelo suporte dentro da plataforma.</p>
          </div>
          <div className="faq" data-reveal>
            {FAQ.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="aurora" aria-hidden="true" />
        <Stars />
        <div className="grain" aria-hidden="true" />
        <div className="lp-wrap center" data-reveal>
          <h2>A próxima prova começa <em>hoje</em>.</h2>
          <p className="lede">Crie sua conta em menos de um minuto.</p>
          <Link to="/login?mode=register" className="btn btn-foil btn-lg">Criar minha conta <Icon name="arrow" size={16} /></Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-in">
          <Logo size={22} />
          <nav><a href="#recursos">Recursos</a><a href="#planos">Planos</a><a href="#faq">Dúvidas</a><Link to="/login">Entrar</Link></nav>
          <small>© {new Date().getFullYear()} MedTrouxa · Conteúdo educacional; não substitui avaliação médica.</small>
        </div>
      </footer>
    </div>
  );
}
