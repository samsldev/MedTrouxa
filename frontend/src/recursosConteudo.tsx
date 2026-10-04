import type { ReactNode } from 'react';
import { Icon } from './components/Brand';

/**
 * Conteúdo das páginas /recursos/:slug. Cada página: hero com demonstração, blocos alternados
 * (texto + visual), FAQ e prova social. Os visuais são mocks estáticos da interface real.
 * Não use números inventados aqui: contagens reais vêm de /public/stats (StatsStrip).
 */
export interface Bloco { tag: string; titulo: string; texto: string; visual: ReactNode }
export interface ConteudoRecurso {
  h1: ReactNode; lede: string; janela: string; demo: ReactNode;
  planos: string; blocos: Bloco[]; faq: [string, string][]; cta: string;
}

/* ---------- visuais reutilizáveis ---------- */

const Alts = ({ certa = 'B', marcada }: { certa?: string; marcada?: string }) => (
  <>
    {[['A', 'Aguardar troponina para confirmar', '4%'], ['B', 'Trombólise em até 30 minutos da chegada', '71%'], ['C', 'Transferir para angioplastia primária', '19%'], ['D', 'Iniciar apenas AAS e observar', '6%']].map(([k, t, p]) => (
      <div key={k} className={`mock-alt ${k === certa ? 'right' : ''} ${k === marcada ? 'wrong' : ''}`}><b>{k}</b>{t}<small>{p}</small></div>
    ))}
  </>
);

const Questao = () => (
  <div className="mock-body">
    <div className="mock-tags"><span>ENAMED 2025</span><span>Cardiologia</span><span>Média</span></div>
    <p className="mock-q">Paciente de 58 anos com dor torácica há 40 minutos e supradesnivelamento de ST em V1–V4. Sem hemodinâmica disponível; transferência levaria 3 horas. Qual a conduta?</p>
    <Alts />
    <div className="mock-comment"><b>Comentário.</b> Sem angioplastia em até 120 minutos, indica-se fibrinólise com porta-agulha ≤ 30 min.</div>
  </div>
);

const Filtros = ({ grupos }: { grupos: [string, string[], number?][] }) => (
  <div className="rp-card">
    {grupos.map(([g, ops, on = 1]) => (
      <div key={g} className="rp-filter">
        <small>{g}</small>
        <div className="rp-chips">{ops.map((o, i) => <span key={o} className={i < on ? 'on' : ''}>{i < on && <Icon name="check" size={11} />}{o}</span>)}</div>
      </div>
    ))}
    <div className="rp-card-foot"><span>Lista personalizada pronta</span><b className="mock-pill">Começar</b></div>
  </div>
);

const Comentario = ({ titulo, linhas }: { titulo: string; linhas: string[] }) => (
  <div className="rp-card">
    <div className="rp-sol"><span className="rp-sol-tag"><Icon name="check" size={12} /> Gabarito: B</span><b>{titulo}</b></div>
    {linhas.map((l, i) => <p key={i} className="rp-line">{l}</p>)}
  </div>
);

const Flash = ({ frente, verso, deck }: { frente: string; verso: string; deck: string }) => (
  <div className="mock-body center-col rp-tight">
    <div className="mock-flash"><small>{deck}</small><p>{frente}</p><hr /><p className="answer">{verso}</p></div>
    <div className="mock-grades"><span className="g bad">Errei</span><span className="g mid">Difícil</span><span className="g good">Bom · 6 dias</span><span className="g easy">Fácil · 12 dias</span></div>
  </div>
);

const Curva = () => (
  <div className="rp-card">
    <small className="rp-label">Quando cada card volta</small>
    <svg className="viz-curve rp-curve" viewBox="0 0 240 120" aria-hidden="true">
      <defs><linearGradient id="rpcg" x1="0" x2="1"><stop offset="0" stopColor="var(--arcane)" /><stop offset="1" stopColor="var(--gold)" /></linearGradient></defs>
      <path d="M10 20 C 30 70, 40 80, 55 84 L55 22 C 80 60, 95 68, 110 70 L110 21 C 140 45, 160 52, 180 54 L180 20 C 200 30, 215 34, 232 36" fill="none" stroke="url(#rpcg)" strokeWidth="2" strokeLinecap="round" />
      {[55, 110, 180].map((x) => <circle key={x} cx={x} cy="21" r="3.5" fill="var(--gold)" />)}
      <line x1="10" y1="104" x2="232" y2="104" stroke="var(--border-strong)" />
      {[['1d', 55], ['6d', 110], ['15d', 180]].map(([t, x]) => <text key={t} x={x} y="117" textAnchor="middle">{t}</text>)}
    </svg>
    <p className="rp-line">Cada revisão no momento certo empurra a próxima para mais longe.</p>
  </div>
);

const Lista = ({ titulo, itens }: { titulo: string; itens: [string, string, string?][] }) => (
  <div className="rp-card">
    <small className="rp-label">{titulo}</small>
    {itens.map(([a, b, tag]) => (
      <div key={a} className="rp-row"><span>{a}</span><small>{b}</small>{tag && <b className="mock-pill">{tag}</b>}</div>
    ))}
  </div>
);

const Barras = ({ titulo, dados }: { titulo: string; dados: [string, number][] }) => (
  <div className="rp-card">
    <small className="rp-label">{titulo}</small>
    {dados.map(([k, v]) => (
      <div key={k} className="rp-bar"><span>{k}</span><i><em style={{ width: `${v}%` }} /></i><small>{v}%</small></div>
    ))}
  </div>
);

const Simulado = () => (
  <div className="mock-body">
    <div className="mock-row"><b>Simulado ENAMED · 40 questões</b><span className="mock-timer">01:24:37</span></div>
    <div className="mock-grid">{Array.from({ length: 40 }, (_, i) => <span key={i} className={i < 23 ? 'done' : i === 23 ? 'now' : ''}>{i + 1}</span>)}</div>
    <div className="mock-row muted-row"><span>23 de 40 respondidas</span><span>Finaliza automaticamente ao fim do tempo</span></div>
  </div>
);

const Cronograma = ({ titulo = 'ENAMED em 8 semanas', pct = 38 }: { titulo?: string; pct?: number }) => (
  <div className="mock-body">
    <div className="mock-row"><b>{titulo}</b><span className="mock-pill">{pct}% concluído</span></div>
    <div className="mock-progress"><div style={{ width: `${pct}%` }} /></div>
    {['Cardiologia: 20 questões', 'Endocrinologia: resumo + flashcards', 'Pneumologia: 20 questões', 'Simulado semanal + revisão dos erros'].map((t, i) => (
      <div key={t} className={`mock-task ${i < 2 ? 'done' : i === 2 ? 'today' : ''}`}>
        <span className="box">{i < 2 && <Icon name="check" size={12} />}</span><small>Dia {19 + i}</small>{t}
      </div>
    ))}
  </div>
);

const Chat = ({ pergunta, titulo, linhas }: { pergunta: string; titulo: string; linhas: string[] }) => (
  <div className="mock-body chatty">
    <div className="mb user">{pergunta}</div>
    <div className="mb bot"><b>✦ {titulo}</b><br />{linhas.map((l) => <span key={l}>• {l}<br /></span>)}</div>
  </div>
);

const Gerador = () => (
  <div className="rp-card">
    <small className="rp-label">Seu resumo</small>
    <p className="rp-quote">“Pré-eclâmpsia: PA ≥ 140x90 após 20 semanas + proteinúria ou lesão de órgão-alvo. Sulfato de magnésio para prevenir convulsão…”</p>
    <div className="rp-arrow"><Icon name="owl" size={16} /> Coruja gerou 3 cards</div>
    {[['Critério temporal da pré-eclâmpsia?', 'Após 20 semanas'], ['Droga para prevenir eclâmpsia?', 'Sulfato de magnésio'], ['Antídoto do sulfato de magnésio?', 'Gluconato de cálcio']].map(([f, v]) => (
      <div key={f} className="rp-row"><span>{f}</span><small>{v}</small></div>
    ))}
  </div>
);

/* ---------- páginas ---------- */

export const CONTEUDO: Record<string, ConteudoRecurso> = {
  'banco-de-questoes': {
    h1: <>Banco de questões <em>comentadas</em></>,
    lede: 'Questões de provas reais com comentário em cada alternativa. Pratique, entenda o erro e domine o conteúdo que cai no ENAMED e na residência.',
    janela: 'questoes', demo: <Questao />, planos: 'Grátis: 20 questões por dia · Ilimitado em todos os planos',
    cta: 'Resolver minha primeira questão',
    blocos: [
      { tag: 'Filtros inteligentes', titulo: 'Estude do seu jeito', texto: 'Filtre por área, tema, banca, ano e dificuldade. Monte listas personalizadas e foque exatamente no que você precisa revisar.', visual: <Filtros grupos={[['Área', ['Clínica Médica', 'Cirurgia', 'Pediatria', 'GO'], 2], ['Banca', ['ENAMED', 'USP-SP', 'UNIFESP', 'SUS-SP'], 1], ['Dificuldade', ['Fácil', 'Média', 'Difícil'], 2]]} /> },
      { tag: 'Comentários', titulo: 'Entenda cada alternativa', texto: 'Não basta saber a certa. O comentário explica por que cada alternativa está certa ou errada, com o raciocínio clínico que a banca espera.', visual: <Comentario titulo="Por que trombólise?" linhas={['A: troponina não muda a conduta no IAM com supra — atrasar é erro.', 'C: transferência de 3h estoura a janela de 120 min para angioplastia.', 'D: AAS isolado não reperfunde a artéria ocluída.']} /> },
      { tag: 'Revisão dos erros', titulo: 'Seus erros viram plano de estudo', texto: 'Filtre só as questões que você errou e refaça até acertar. Veja também como a comunidade marcou cada alternativa e onde a maioria tropeça.', visual: <Barras titulo="Como a comunidade respondeu" dados={[['A', 4], ['B', 71], ['C', 19], ['D', 6]]} /> },
    ],
    faq: [
      ['De onde vêm as questões?', 'De provas reais de residência e do ENAMED, organizadas por área, tema, banca e ano.'],
      ['Todas as questões têm comentário?', 'Sim. Depois de responder você vê o gabarito comentado e como os outros estudantes marcaram cada alternativa.'],
      ['Posso refazer só as que errei?', 'Pode. Há um filtro só para as questões que você errou.'],
      ['Dá pra usar de graça?', 'Sim. A conta gratuita libera 20 questões comentadas por dia, sem cartão.'],
      ['Funciona no celular?', 'Sim, no navegador do celular, tablet ou computador.'],
    ],
  },

  flashcards: {
    h1: <>Flashcards que <em>lembram por você</em></>,
    lede: 'Repetição espaçada de verdade: cada card volta no dia exato em que você estaria prestes a esquecer. Menos tempo revisando, mais tempo lembrando.',
    janela: 'flashcards', demo: <Flash deck="Cardiologia · Cardio de bolso" frente="Tríade de Beck" verso="Hipotensão, turgência jugular e abafamento de bulhas — tamponamento cardíaco." />,
    planos: 'Incluído em todos os planos, inclusive no grátis', cta: 'Criar meu primeiro baralho',
    blocos: [
      { tag: 'Repetição espaçada', titulo: 'O algoritmo decide quando revisar', texto: 'Usamos o SM-2, o método por trás dos melhores apps de memorização. Você só abre o app e revisa o que está vencendo hoje.', visual: <Curva /> },
      { tag: 'Seus baralhos', titulo: 'Crie, organize e apague', texto: 'Monte baralhos por matéria, rodízio ou prova. Edite e apague cards quando quiser — seus baralhos, suas regras.', visual: <Lista titulo="Meus baralhos" itens={[['Cardio de bolso', '42 cards', '8 hoje'], ['Antibióticos', '67 cards', '12 hoje'], ['Pediatria — vacinas', '30 cards'], ['Erros do simulado 3', '18 cards', '5 hoje']]} /> },
      { tag: 'Do erro ao card', titulo: 'Errou? Vira flashcard', texto: 'O que você erra nas questões é o que mais vale memorizar. Transforme o erro em card e ele volta até virar reflexo.', visual: <Flash deck="Erros do simulado 3" frente="Antídoto do sulfato de magnésio" verso="Gluconato de cálcio." /> },
    ],
    faq: [
      ['O que é repetição espaçada?', 'Uma técnica em que cada card é revisado em intervalos crescentes, logo antes de você esquecer. Rende muito mais que reler resumos.'],
      ['Posso criar meus próprios cards?', 'Sim, em quantos baralhos quiser (até 200 por conta), e apagar baralhos ou cards específicos a qualquer momento.'],
      ['A Coruja pode criar cards pra mim?', 'Pode: cole um resumo e ela gera os flashcards. Veja a página Flashcards com IA.'],
      ['Está no plano grátis?', 'Sim, os flashcards estão em todos os planos, inclusive na conta gratuita.'],
    ],
  },

  simulados: {
    h1: <>Simulados no <em>ritmo da prova real</em></>,
    lede: 'Cronômetro, gabarito comentado e nota ao final. Treine resistência e gestão de tempo antes do dia que importa.',
    janela: 'simulados', demo: <Simulado />, planos: 'Incluído em todos os planos pagos', cta: 'Fazer meu primeiro simulado',
    blocos: [
      { tag: 'Cronômetro', titulo: 'Treine contra o relógio', texto: 'O tempo corre como na prova e o simulado finaliza sozinho quando acaba. Você descobre seu ritmo antes da hora H.', visual: <Simulado /> },
      { tag: 'Resultado', titulo: 'Nota e gabarito na hora', texto: 'Ao terminar, veja sua nota, o desempenho por área e o comentário de cada questão. Sem esperar, sem planilha.', visual: <Barras titulo="Seu resultado por área" dados={[['Clínica', 78], ['Cirurgia', 62], ['Pediatria', 70], ['GO', 55], ['Preventiva', 84]]} /> },
      { tag: 'Revisão', titulo: 'O simulado vira plano de estudo', texto: 'As áreas mais fracas aparecem primeiro. Refaça os erros e transforme os temas que falharam em flashcards.', visual: <Lista titulo="Para revisar" itens={[['Ginecologia e Obstetrícia', '9 erros', 'Prioridade'], ['Cirurgia do trauma', '6 erros'], ['Neonatologia', '4 erros']]} /> },
    ],
    faq: [
      ['Os simulados são cronometrados?', 'Sim, e finalizam automaticamente ao fim do tempo, como na prova.'],
      ['Recebo o gabarito?', 'Sim, com nota e comentário de cada questão logo ao terminar.'],
      ['Posso pausar?', 'O cronômetro segue como na prova real. Para estudar sem pressão, use o banco de questões.'],
    ],
  },

  desempenho: {
    h1: <>Saiba exatamente <em>onde você está</em></>,
    lede: 'Painel de desempenho por área e ranking entre estudantes. Pare de estudar no escuro: veja sua evolução e onde focar.',
    janela: 'desempenho', demo: <div className="mock-body rp-tight"><Barras titulo="Acertos por grande área" dados={[['Clínica Médica', 74], ['Cirurgia', 61], ['Pediatria', 69], ['GO', 52], ['Preventiva', 83]]} /></div>,
    planos: 'Incluído em todos os planos', cta: 'Ver meu desempenho',
    blocos: [
      { tag: 'Painel', titulo: 'Sua evolução em um olhar', texto: 'Acertos por área e tema, questões resolvidas e cards revisados. Você vê o que melhorou e o que ainda trava.', visual: <Barras titulo="Últimas 4 semanas" dados={[['Semana 1', 58], ['Semana 2', 63], ['Semana 3', 67], ['Semana 4', 72]]} /> },
      { tag: 'Ranking', titulo: 'Compare-se com quem presta a mesma prova', texto: 'O ranking mostra sua posição entre os estudantes da plataforma. Uma dose saudável de competição para manter o ritmo.', visual: <Lista titulo="Ranking da semana" itens={[['1º  Ana L.', '1.240 pts'], ['2º  Rafael M.', '1.180 pts'], ['3º  Beatriz C.', '1.105 pts'], ['12º  Você', '890 pts', '↑ 5']]} /> },
      { tag: 'Foco', titulo: 'Seus pontos fracos viram prioridade', texto: 'Os temas com menor acerto aparecem primeiro, com atalho direto para questões daquele tema.', visual: <Lista titulo="Temas para reforçar" itens={[['Hemorragias da gestação', '41% de acerto', 'Treinar'], ['Trauma abdominal', '48% de acerto'], ['Icterícia neonatal', '53% de acerto']]} /> },
    ],
    faq: [
      ['O ranking mostra meu nome?', 'O ranking compara estudantes da plataforma. Você pode ajustar suas informações de perfil na sua conta.'],
      ['O desempenho conta questões e simulados?', 'Sim, tudo que você resolve entra no seu painel.'],
    ],
  },

  cronogramas: {
    h1: <>Cronogramas guiados: <em>é só seguir o mapa</em></>,
    lede: 'Planos dia a dia para ENAMED, residência e internato. Você para de decidir o que estudar e passa a estudar.',
    janela: 'cronogramas', demo: <Cronograma />, planos: 'Incluído no Alquimista e no Arcano', cta: 'Começar meu cronograma',
    blocos: [
      { tag: 'Dia a dia', titulo: 'Cada dia com uma missão clara', texto: 'Questões, flashcards e revisões na ordem certa. Marque como feito e veja o progresso subir.', visual: <Cronograma titulo="Hoje · Dia 21" pct={52} /> },
      { tag: 'Trilhas', titulo: 'Um plano para cada objetivo', texto: 'ENAMED, residência ou internato: escolha sua prova e o cronograma se organiza em torno dela.', visual: <Lista titulo="Escolha seu cronograma" itens={[['ENAMED', '8 semanas', 'Popular'], ['Residência', 'Ciclo completo'], ['Internato', 'Por rodízio']]} /> },
      { tag: 'Constância', titulo: 'Atrasou? O plano se ajusta', texto: 'Vida de estudante de medicina é imprevisível. O que ficou pra trás reaparece, sem você precisar refazer tudo.', visual: <Lista titulo="Pendências" itens={[['Dia 18 · Nefrologia', 'remarcado para hoje', 'Hoje'], ['Dia 19 · Simulado', 'concluído']]} /> },
    ],
    faq: [
      ['Quais cronogramas existem?', 'ENAMED, Residência e Internato.'],
      ['Em qual plano está?', 'No Alquimista e no Arcano.'],
      ['Preciso seguir à risca?', 'Não. O cronograma é um guia; você pode adiantar ou retomar dias quando quiser.'],
    ],
  },

  'provas-na-integra': {
    h1: <>Provas de residência <em>na íntegra</em></>,
    lede: 'Faça a prova inteira, na ordem original, como no dia. Conheça o estilo de cada banca antes de enfrentá-la.',
    janela: 'provas', demo: <div className="mock-body rp-tight"><Lista titulo="Provas disponíveis" itens={[['ENAMED', 'prova completa', 'Nova'], ['USP-SP', 'prova completa'], ['UNIFESP', 'prova completa'], ['SUS-SP', 'prova completa']]} /></div>,
    planos: 'Incluído no Alquimista e no Arcano', cta: 'Fazer uma prova completa',
    blocos: [
      { tag: 'Como no dia', titulo: 'A prova inteira, na ordem original', texto: 'Nada de questões soltas: você enfrenta a sequência real, com o cansaço e a gestão de tempo do dia da prova.', visual: <Simulado /> },
      { tag: 'Banca', titulo: 'Conheça o estilo de cada banca', texto: 'Cada instituição tem seus temas favoritos e suas pegadinhas. Fazer a prova inteira é o jeito mais rápido de aprender a jogar o jogo dela.', visual: <Questao /> },
      { tag: 'Comentários', titulo: 'Gabarito comentado em todas', texto: 'Terminou? Revise cada questão com o comentário e veja onde você perdeu pontos.', visual: <Comentario titulo="Questão 37 · USP-SP" linhas={['A banca cobra a janela de 120 min para angioplastia primária.', 'Pegadinha clássica: esperar troponina atrasa a reperfusão.']} /> },
    ],
    faq: [
      ['Quais provas estão disponíveis?', 'Provas de residência e do ENAMED; o acervo cresce com as novas edições.'],
      ['Em qual plano está?', 'No Alquimista e no Arcano.'],
      ['Tem cronômetro?', 'Sim, você pode fazer a prova cronometrada, como um simulado.'],
    ],
  },

  'mapa-de-provas': {
    h1: <>Mapa de provas: <em>o que mais cai</em> por banca</>,
    lede: 'Veja quais temas cada banca mais cobra e estude primeiro o que dá mais pontos. Estratégia, não sorte.',
    janela: 'mapa-de-provas', demo: <div className="mock-body rp-tight"><Barras titulo="ENAMED · temas mais cobrados" dados={[['Preventiva', 22], ['Clínica Médica', 20], ['Pediatria', 18], ['GO', 17], ['Cirurgia', 16]]} /></div>,
    planos: 'Incluído no Alquimista e no Arcano', cta: 'Ver o mapa da minha prova',
    blocos: [
      { tag: 'Por banca', titulo: 'Cada prova tem sua cara', texto: 'Escolha a instituição e veja a distribuição de temas. Você descobre onde concentrar esforço antes de abrir o primeiro livro.', visual: <Filtros grupos={[['Banca', ['ENAMED', 'USP-SP', 'UNIFESP', 'SUS-SP'], 1], ['Período', ['Últimos 3 anos', 'Últimos 5 anos'], 1]]} /> },
      { tag: 'Prioridade', titulo: 'Estude o que dá mais pontos', texto: 'Temas ordenados pela frequência real nas provas. Comece pelo topo da lista e cada hora de estudo rende mais.', visual: <Lista titulo="Top temas · Clínica Médica" itens={[['Insuficiência cardíaca', 'muito frequente', 'Top 1'], ['Diabetes', 'muito frequente'], ['Pneumonias', 'frequente'], ['Doença renal crônica', 'frequente']]} /> },
      { tag: 'Direto ao ponto', titulo: 'Do mapa para a questão', texto: 'Cada tema do mapa leva às questões daquele tema, daquela banca. Viu, treinou.', visual: <Questao /> },
    ],
    faq: [
      ['Como o mapa é feito?', 'A partir da classificação por tema das questões das provas de cada banca.'],
      ['Em qual plano está?', 'No Alquimista e no Arcano.'],
    ],
  },

  aprofundamento: {
    h1: <>Comentários que vão <em>além do gabarito</em></>,
    lede: 'Para quem quer entender de verdade: fisiopatologia, diagnóstico diferencial e as pegadinhas que a banca adora.',
    janela: 'aprofundamento', demo: <div className="mock-body rp-tight"><Comentario titulo="Aprofundamento · IAM com supra" linhas={['Fisiopatologia: oclusão total da coronária — cada minuto é miocárdio perdido.', 'Diferencial: pericardite tem supra difuso côncavo e infra de PR.', 'Pegadinha: BRE novo equivale a supra até prova em contrário.']} /></div>,
    planos: 'Incluído no Alquimista e no Arcano', cta: 'Ver um aprofundamento',
    blocos: [
      { tag: 'Profundidade', titulo: 'O porquê por trás da resposta', texto: 'O comentário comum diz qual é a certa. O aprofundamento explica o mecanismo, para você acertar qualquer variação da pergunta.', visual: <Comentario titulo="Por que a fibrinólise funciona?" linhas={['Ativa o plasminogênio e dissolve o trombo recente.', 'Eficácia cai muito após 12h do início da dor.']} /> },
      { tag: 'Diferenciais', titulo: 'Diagnósticos diferenciais lado a lado', texto: 'As doenças que a banca usa para confundir aparecem comparadas, com o achado que separa uma da outra.', visual: <Lista titulo="IAM × Pericardite" itens={[['Supra de ST', 'localizado × difuso'], ['Infra de PR', 'ausente × presente'], ['Dor', 'opressiva × pleurítica']]} /> },
      { tag: 'Pegadinhas', titulo: 'As armadilhas, antes da prova', texto: 'Os detalhes que derrubam candidatos bem preparados, destacados para você não cair neles.', visual: <Comentario titulo="Pegadinhas frequentes" linhas={['Proteinúria não é obrigatória na pré-eclâmpsia com lesão de órgão-alvo.', 'Antes de 20 semanas, pense em mola hidatiforme.']} /> },
    ],
    faq: [
      ['Qual a diferença para o comentário normal?', 'O comentário explica o gabarito; o aprofundamento vai à fisiopatologia, aos diferenciais e às pegadinhas.'],
      ['Em qual plano está?', 'No Alquimista e no Arcano.'],
    ],
  },

  'coruja-ia': {
    h1: <>A Coruja, sua <em>tutora de medicina</em> 24h</>,
    lede: 'Tire dúvidas, peça para explicar uma questão ou resumir um tema. Às 3 da manhã antes da prova, ela está acordada.',
    janela: 'coruja', demo: <Chat pergunta="Quais as pegadinhas de prova sobre pré-eclâmpsia?" titulo="Resumo de bolso" linhas={['Sulfato de magnésio previne e trata a eclâmpsia — antídoto: gluconato de cálcio.', 'Proteinúria não é obrigatória se houver lesão de órgão-alvo.', 'Após 20 semanas; antes disso, pense em mola hidatiforme.']} />,
    planos: 'Em todos os planos pagos · uso 3x maior no Alquimista e no Arcano', cta: 'Conversar com a Coruja',
    blocos: [
      { tag: 'Explicações', titulo: 'Não entendeu o comentário? Pergunte', texto: 'A Coruja explica a questão do jeito que você precisa: mais simples, mais fundo ou com um exemplo clínico.', visual: <Chat pergunta="Por que não esperar a troponina nesse caso?" titulo="Explicação" linhas={['O ECG já fecha o diagnóstico de IAM com supra.', 'Esperar a troponina atrasa a reperfusão — tempo é miocárdio.']} /> },
      { tag: 'Resumos', titulo: 'Um tema inteiro em 1 minuto', texto: 'Peça o resumo de bolso de qualquer tema: critérios, condutas e o que mais cai, organizado para revisão.', visual: <Chat pergunta="Resume insuficiência cardíaca pra prova" titulo="Resumo de bolso" linhas={['Classificação por fração de ejeção: reduzida, levemente reduzida e preservada.', 'Pilares na FE reduzida: IECA/BRA/INRA, betabloqueador, espironolactona, iSGLT2.']} /> },
      { tag: 'Flashcards', titulo: 'Seus resumos viram flashcards', texto: 'Cole seu resumo e a Coruja gera os cards prontos para a repetição espaçada.', visual: <Gerador /> },
    ],
    faq: [
      ['A Coruja substitui um professor?', 'Ela acelera o estudo: explica questões, resume temas e cria flashcards. É conteúdo educacional e não substitui avaliação médica.'],
      ['Tem limite de uso?', 'Sim: 30 mensagens por hora no Aprendiz e 90 por hora no Alquimista e no Arcano.'],
      ['Está no plano grátis?', 'Não. A Coruja está nos planos pagos.'],
    ],
  },

  'flashcards-com-ia': {
    h1: <>Seus resumos viram <em>flashcards</em> em segundos</>,
    lede: 'Cole o resumo da aula e a Coruja IA gera os cards prontos. Você para de digitar e começa a memorizar.',
    janela: 'flashcards-ia', demo: <div className="mock-body rp-tight"><Gerador /></div>,
    planos: 'Em todos os planos pagos', cta: 'Gerar meus flashcards',
    blocos: [
      { tag: 'Velocidade', titulo: 'De resumo a baralho em segundos', texto: 'O tempo que você gastaria criando cards à mão vira tempo de revisão. A Coruja extrai o que importa e monta perguntas objetivas.', visual: <Gerador /> },
      { tag: 'Controle', titulo: 'Você revisa, edita e decide', texto: 'Os cards gerados entram no baralho que você escolher. Apague ou ajuste o que quiser.', visual: <Lista titulo="Obstetrícia · gerado agora" itens={[['Critério temporal da pré-eclâmpsia?', 'novo'], ['Droga para prevenir eclâmpsia?', 'novo'], ['Antídoto do sulfato de magnésio?', 'novo']]} /> },
      { tag: 'Memória', titulo: 'Direto para a repetição espaçada', texto: 'Os cards gerados já entram no algoritmo SM-2 e voltam no momento certo.', visual: <Curva /> },
    ],
    faq: [
      ['Que tipo de texto posso colar?', 'Resumos, anotações de aula e trechos de material de estudo.'],
      ['Os cards ficam salvos?', 'Sim, entram no baralho que você escolher e seguem a repetição espaçada.'],
      ['Está no plano grátis?', 'A geração com IA usa a Coruja, que está nos planos pagos.'],
    ],
  },
};
