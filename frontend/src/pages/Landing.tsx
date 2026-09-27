import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, Logo, Stars } from '../components/Brand';
import Pricing from '../components/Pricing';

const TABS = [
  { id: 'questoes', icon: 'questions', label: 'Questões', title: 'Questões comentadas', text: 'Monte listas do seu jeito: área, tema, banca, ano, dificuldade — ou só as que você errou.' },
  { id: 'flashcards', icon: 'cards', label: 'Flashcards', title: 'Flashcards que lembram por você', text: 'Repetição espaçada (SM-2): cada card volta no dia exato em que você estaria prestes a esquecer.' },
  { id: 'simulados', icon: 'timer', label: 'Simulados', title: 'Simulados com cronômetro', text: 'Treine no ritmo da prova real e receba nota e gabarito comentado ao final.' },
  { id: 'coruja', icon: 'owl', label: 'Coruja IA', title: 'A Coruja, sua tutora com IA', text: 'Explica questões, resume condutas e transforma seus resumos em flashcards.' },
  { id: 'cronogramas', icon: 'calendar', label: 'Cronogramas', title: 'Cronogramas guiados', text: 'Planos dia a dia para ENAMED, residência e internato. É só seguir o mapa.' },
] as const;

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

export default function Landing() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('questoes');
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="landing">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <Link to="/"><Logo /></Link>
          <nav>
            <a href="#recursos">Recursos</a>
            <a href="#metodo">Método</a>
            <a href="#planos">Planos</a>
            <a href="#faq">Dúvidas</a>
          </nav>
          <div className="lp-nav-cta">
            <Link to="/login" className="btn btn-text">Entrar</Link>
            <Link to="/login?mode=register" className="btn btn-dark">Começar</Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <Stars />
        <div className="lp-wrap hero-in">
          <span className="eyebrow"><Icon name="spark" size={14} /> Medicina, com um toque de magia</span>
          <h1>Estude medicina como quem <em>domina um feitiço</em>.</h1>
          <p className="lede">Questões comentadas, flashcards com repetição espaçada, simulados e uma tutora com IA. Da faculdade ao ENAMED e à residência, em um só lugar.</p>
          <div className="hero-cta">
            <Link to="/login?mode=register" className="btn btn-dark btn-lg">Começar agora <Icon name="arrow" size={16} /></Link>
            <a href="#planos" className="btn btn-text btn-lg">Ver planos</a>
          </div>
        </div>

        <div className="lp-wrap">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                <Icon name={t.icon} size={16} /> {t.label}
              </button>
            ))}
          </div>
          <div className="showcase">
            <div className="window">
              <div className="window-bar"><i /><i /><i /><span>medtrouxa.com.br · {current.label}</span></div>
              <Mock tab={tab} />
            </div>
            <div className="showcase-caption">
              <Icon name={current.icon} size={20} />
              <div><b>{current.title}</b><span>{current.text}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="lp-section">
        <div className="lp-wrap">
          <div className="section-head">
            <span className="kicker">Recursos</span>
            <h2>Tudo que você precisa. <em>Nada que distraia.</em></h2>
          </div>
          <div className="features">
            {[
              ['questions', 'Banco de questões', 'Comentários objetivos e a porcentagem de marcação da comunidade em cada alternativa.'],
              ['cards', 'Repetição espaçada', 'O algoritmo decide quando cada card volta. Você só aparece e revisa.'],
              ['timer', 'Simulados reais', 'Tempo de prova, finalização automática e nota com gabarito comentado.'],
              ['owl', 'Coruja IA', 'Explicações sob demanda e flashcards gerados a partir dos seus resumos.'],
              ['calendar', 'Cronogramas', 'Planos dia a dia com progresso, para ENAMED, residência e internato.'],
              ['trophy', 'Desempenho e ranking', 'Aproveitamento por área, sequência de dias e XP para manter o ritmo.'],
            ].map(([icon, title, text]) => (
              <div key={title} className="feature">
                <span className="feature-icon"><Icon name={icon} size={20} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="metodo" className="lp-section tinted">
        <div className="lp-wrap">
          <div className="section-head">
            <span className="kicker">Método</span>
            <h2>Três gestos. <em>Repetidos todos os dias.</em></h2>
          </div>
          <ol className="steps">
            {[
              ['Resolva', 'Comece pelas questões. Errar cedo é o jeito mais rápido de descobrir o que cai.'],
              ['Revise', 'Cada erro vira flashcard e volta no momento certo, até virar reflexo.'],
              ['Domine', 'Simulados medem o progresso e o cronograma mostra o próximo passo.'],
            ].map(([t, d], i) => (
              <li key={t}><span className="step-n">{['I', 'II', 'III'][i]}</span><h3>{t}</h3><p>{d}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section id="planos" className="lp-section">
        <div className="lp-wrap">
          <div className="section-head center">
            <span className="kicker">Planos</span>
            <h2>Escolha seu <em>grau de maestria</em>.</h2>
            <p className="lede small">Assinaturas anuais em até 12x no cartão, ou à vista no Pix.</p>
          </div>
          <Pricing ctaHref={(id) => `/checkout/${id}`} />
          <p className="fine center"><Icon name="shield" size={14} /> Pagamento seguro · Acesso liberado na hora após a confirmação</p>
        </div>
      </section>

      <section id="faq" className="lp-section tinted">
        <div className="lp-wrap narrow">
          <div className="section-head center">
            <span className="kicker">Dúvidas</span>
            <h2>Perguntas frequentes</h2>
          </div>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <Stars />
        <div className="lp-wrap center">
          <h2>A próxima prova começa <em>hoje</em>.</h2>
          <Link to="/login?mode=register" className="btn btn-gold btn-lg">Criar minha conta <Icon name="arrow" size={16} /></Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-in">
          <Logo size={22} />
          <small>© {new Date().getFullYear()} MedTrouxa · Conteúdo educacional; não substitui avaliação médica.</small>
        </div>
      </footer>
    </div>
  );
}
