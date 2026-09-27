/**
 * Roteiros dos 9 criativos (Meta Ads). Todo claim é verdadeiro sobre o produto:
 * preços reais dos planos, 20 questões grátis/dia no plano gratuito, 7 dias de garantia (CDC),
 * planos anuais sem renovação automática, recursos que existem no app.
 * NÃO usar números de alunos/aprovados fictícios — anúncio com dado falso viola as políticas do Meta.
 *
 * Estrutura de cada vídeo (15 s): gancho 0–3 · dor 3–7 · virada 7–11.5 · oferta 11.5–15.
 * Texto entre *asteriscos* vira itálico dourado (o "em" do site).
 */

export const PRECOS = {
  aprendiz: '12x de R$ 59,90',
  alquimista: '12x de R$ 79,90',
  arcano: '12x de R$ 189,90',
};

// ---------------------------------------------------------------- REELS (feed, 9:16)
export const REELS = [
  {
    slug: 'criativo_1',
    tema: 'Estudo passivo: estuda muito, esquece na prova',
    trilha: 1,
    ghost: 'PROVA',
    gancho: { kicker: 'Estudante de medicina', linhas: ['Você estuda 6 horas…', '…e na hora da prova', '*dá branco.*'] },
    dor: {
      titulo: 'O problema *não é você.*',
      itens: ['Ler e reler resumo', 'Grifar o livro inteiro', 'Estudar só na véspera'],
      fecho: 'Isso é estudo passivo. *O cérebro descarta.*',
    },
    virada: {
      kicker: 'A virada',
      titulo: 'Estudo ativo, *no automático.*',
      mock: 'questao',
      chips: ['Questões comentadas', 'Flashcards com revisão espaçada', 'Coruja IA explica tudo'],
    },
    oferta: {
      titulo: 'Comece *grátis* hoje.',
      linha: '20 questões comentadas por dia, sem pagar nada.',
      cta: 'Criar conta grátis',
      rodape: `Planos a partir de ${PRECOS.aprendiz} · 7 dias de garantia`,
    },
  },
  {
    slug: 'criativo_2',
    tema: 'ENAMED/Residência sem direção',
    trilha: 2,
    ghost: 'ENAMED',
    gancho: { kicker: 'ENAMED e Residência', linhas: ['A prova chegando…', '…e você ainda', '*sem saber por onde começar?*'] },
    dor: {
      titulo: 'Sem plano, *todo dia vira:*',
      itens: ['PDF de 300 páginas', 'Aula que nunca termina', 'Culpa de domingo à noite'],
      fecho: 'Esforço sem direção *não vira nota.*',
    },
    virada: {
      kicker: 'A virada',
      titulo: 'Saiba *exatamente* o que estudar hoje.',
      mock: 'cronograma',
      chips: ['Cronogramas guiados', 'Simulados cronometrados', 'Mapa do que mais cai por banca'],
    },
    oferta: {
      titulo: 'Seu plano começa *hoje.*',
      linha: 'Cronograma dia a dia para ENAMED, Residência e Internato.',
      cta: 'Montar meu cronograma',
      rodape: `Alquimista em ${PRECOS.alquimista} · 7 dias de garantia`,
    },
  },
  {
    slug: 'criativo_3',
    tema: 'Dúvida sozinho na madrugada',
    trilha: 3,
    ghost: '02:00',
    gancho: { kicker: 'Madrugada de estudo', linhas: ['2h da manhã.', 'Travou na questão.', '*E não tem a quem perguntar.*'] },
    dor: {
      titulo: 'Gabarito seco *não ensina.*',
      itens: ['“Letra C.” E daí?', 'Vídeo de 40 min por 1 dúvida', 'Fórum que ninguém responde'],
      fecho: 'Dúvida que fica *vira erro na prova.*',
    },
    virada: {
      kicker: 'Conheça a Coruja',
      titulo: 'Sua tutora de medicina, *24h por dia.*',
      mock: 'chat',
      chips: ['Explica cada alternativa', 'Resume condutas', 'Cria flashcards pra você'],
    },
    oferta: {
      titulo: 'Tire a próxima dúvida *agora.*',
      linha: 'Questões comentadas + Coruja IA no mesmo lugar.',
      cta: 'Conhecer a Coruja',
      rodape: `Planos a partir de ${PRECOS.aprendiz} · 7 dias de garantia`,
    },
  },
];

// ---------------------------------------------------------------- STORIES (9:16, formato de enquete/quiz)
export const STORIES = [
  {
    slug: 'criativo_1',
    tema: 'Revisão: o conteúdo some sem revisão',
    trilha: 1,
    ghost: 'REVISÃO',
    gancho: { tipo: 'enquete', kicker: 'Seja sincero', pergunta: 'Você revisa o que estudou semana passada?', opcoes: ['Sim, sempre', 'Hmm… não'], escolhida: 1 },
    dor: {
      tipo: 'curva',
      titulo: 'Sem revisão, *o conteúdo some.*',
      legenda: 'A curva do esquecimento não perdoa: o que você não revisa, você perde.',
    },
    virada: {
      kicker: 'A virada',
      titulo: 'O MedTrouxa *agenda sua revisão.*',
      mock: 'flashcard',
      chips: ['Repetição espaçada', 'Cada card volta na hora certa'],
    },
    oferta: {
      titulo: 'Pare de *esquecer.*',
      linha: 'Comece grátis: 20 questões por dia + flashcards.',
      cta: 'Toque no link',
      rodape: '7 dias de garantia nos planos pagos',
    },
  },
  {
    slug: 'criativo_2',
    tema: '3 sinais de que vai chegar despreparado no ENAMED',
    trilha: 2,
    ghost: 'ENAMED',
    gancho: { tipo: 'titulo', kicker: 'ENAMED 2026', linhas: ['3 sinais de que', 'você vai chegar', '*despreparado.*'] },
    dor: {
      tipo: 'sinais',
      titulo: 'Se você…',
      itens: ['nunca fez simulado cronometrado', 'estuda sem cronograma', 'não sabe o que mais cai na sua banca'],
      fecho: '…é hora de *mudar o jogo.*',
    },
    virada: {
      kicker: 'A virada',
      titulo: 'Treine *como na prova.*',
      mock: 'simulado',
      chips: ['Simulados cronometrados', 'Gabarito comentado', 'Cronogramas guiados'],
    },
    oferta: {
      titulo: 'Chegue *pronto.*',
      linha: 'Simulados + cronograma + mapa de provas.',
      cta: 'Toque no link',
      rodape: `Alquimista em ${PRECOS.alquimista} · 7 dias de garantia`,
    },
  },
  {
    slug: 'criativo_3',
    tema: 'Quiz: o que você faz com uma dúvida às 2h',
    trilha: 3,
    ghost: '02:00',
    gancho: { tipo: 'quiz', kicker: 'Quiz rápido', pergunta: '2h da manhã, travou numa questão. Você…', opcoes: ['Googla por 1 hora', 'Vê um vídeo de 40 min', 'Desiste e vai dormir', 'Pergunta pra Coruja'], escolhida: 3 },
    dor: {
      tipo: 'lista',
      titulo: 'A, B e C *custam caro:*',
      itens: ['Tempo que você não tem', 'Resposta que não explica', 'Dúvida que volta na prova'],
      fecho: 'A resposta certa é *D.*',
    },
    virada: {
      kicker: 'Conheça a Coruja',
      titulo: 'Sua tutora com IA, *na hora.*',
      mock: 'chat',
      chips: ['Explica cada alternativa', '24h por dia'],
    },
    oferta: {
      titulo: 'Sua próxima dúvida, *resolvida.*',
      linha: 'Questões comentadas + Coruja IA.',
      cta: 'Toque no link',
      rodape: `Planos a partir de ${PRECOS.aprendiz} · 7 dias de garantia`,
    },
  },
];

// ---------------------------------------------------------------- CARROSSEL (feed 4:5, 5 lâminas cada)
export const CARROSSEIS = [
  {
    slug: 'criativo_1',
    tema: 'Por que você esquece o que estuda',
    ghost: 'MEMÓRIA',
    laminas: [
      { tipo: 'capa', kicker: 'Estudante de medicina', titulo: 'Você estuda muito *e lembra pouco?*', sub: 'Não é falta de esforço. É o método.' },
      { tipo: 'lista', titulo: 'Os 3 hábitos que *sabotam* sua memória', itens: ['Ler e reler o mesmo resumo', 'Grifar tudo (e não testar nada)', 'Estudar só na véspera'], x: true },
      { tipo: 'explica', kicker: 'O que funciona', titulo: 'Recuperação ativa + *revisão espaçada.*', texto: 'Testar a si mesmo (questões, flashcards) e revisar no intervalo certo é o que faz o conteúdo ficar.', mock: 'flashcard' },
      { tipo: 'recursos', titulo: 'O MedTrouxa faz isso *por você.*', itens: [['questions', 'Questões comentadas', 'filtros por área, tema e banca'], ['cards', 'Flashcards', 'repetição espaçada automática'], ['owl', 'Coruja IA', 'explica qualquer dúvida'], ['timer', 'Simulados', 'cronometrados, com gabarito']] },
      { tipo: 'cta', titulo: 'Comece *grátis* hoje.', linha: '20 questões comentadas por dia, sem cartão.', cta: 'Criar conta grátis', rodape: `Planos a partir de ${PRECOS.aprendiz} · 7 dias de garantia` },
    ],
  },
  {
    slug: 'criativo_2',
    tema: 'ENAMED/Residência: estudar com direção',
    ghost: 'ENAMED',
    laminas: [
      { tipo: 'capa', kicker: 'ENAMED e Residência', titulo: 'Estudando pro ENAMED *sem plano?*', sub: 'Leia antes de abrir mais um PDF.' },
      { tipo: 'lista', titulo: 'O custo de estudar *sem direção*', itens: ['Horas em assunto que quase não cai', 'Revisão que nunca acontece', 'Ansiedade de não saber se está no caminho'], x: true },
      { tipo: 'explica', kicker: 'O que muda o jogo', titulo: 'Um plano *dia a dia.*', texto: 'Saber o que estudar hoje, treinar com simulado cronometrado e focar no que mais cai na sua banca.', mock: 'cronograma' },
      { tipo: 'recursos', titulo: 'Tudo isso *num lugar só.*', itens: [['calendar', 'Cronogramas guiados', 'ENAMED, Residência e Internato'], ['timer', 'Simulados', 'cronometrados, com gabarito'], ['trophy', 'Mapa de provas', 'o que mais cai por banca'], ['questions', 'Questões comentadas', 'com filtros por banca']] },
      { tipo: 'cta', titulo: 'Seu plano começa *hoje.*', linha: 'Escolha seu cronograma e comece a treinar.', cta: 'Montar meu cronograma', rodape: `Alquimista em ${PRECOS.alquimista} · 7 dias de garantia` },
    ],
  },
  {
    slug: 'criativo_3',
    tema: 'Dúvida não pode esperar (Coruja IA)',
    ghost: 'CORUJA',
    laminas: [
      { tipo: 'capa', kicker: 'Madrugada de estudo', titulo: 'Travou numa questão *às 2h da manhã?*', sub: 'Você não precisa esperar até a próxima aula.' },
      { tipo: 'lista', titulo: 'O que costuma acontecer', itens: ['Uma hora no Google', 'Vídeo de 40 minutos por 1 dúvida', 'A dúvida volta… na prova'], x: true },
      { tipo: 'explica', kicker: 'Conheça a Coruja', titulo: 'Sua tutora de medicina *com IA.*', texto: 'Pergunte com suas palavras: ela explica a conduta, cada alternativa e as pegadinhas de prova.', mock: 'chat' },
      { tipo: 'recursos', titulo: 'Coruja + tudo que *você precisa.*', itens: [['owl', 'Coruja IA', 'explica cada alternativa'], ['questions', 'Questões comentadas', 'com filtros'], ['cards', 'Flashcards', 'gerados a partir dos seus resumos'], ['calendar', 'Cronogramas', 'para ENAMED e Residência']] },
      { tipo: 'cta', titulo: 'Sua próxima dúvida, *resolvida.*', linha: 'Questões comentadas + Coruja IA no mesmo lugar.', cta: 'Conhecer o MedTrouxa', rodape: `Planos a partir de ${PRECOS.aprendiz} · 7 dias de garantia` },
    ],
  },
];
