/**
 * Catálogo de recursos do menu "Recursos" (mega menu do site público).
 * Cada item já tem o endereço da sua futura página (/recursos/<slug>). Enquanto `pagina` for false,
 * o link aponta para a seção de recursos da landing. Para publicar a página de um recurso:
 * crie o componente, registre a rota /recursos/:slug no App e troque `pagina` para true.
 */
export interface Recurso { slug: string; icon: string; titulo: string; descricao: string; pagina: boolean }
export interface GrupoRecursos { id: string; nome: string; icon: string; tom: 'ouro' | 'arcano' | 'coruja'; itens: Recurso[] }

export const RECURSOS: GrupoRecursos[] = [
  {
    id: 'estudos', nome: 'MedTrouxa Estudos', icon: 'book', tom: 'ouro',
    itens: [
      { slug: 'banco-de-questoes', icon: 'questions', titulo: 'Banco de Questões', descricao: 'Pratique com questões comentadas', pagina: true },
      { slug: 'flashcards', icon: 'cards', titulo: 'Flashcards', descricao: 'Memorize com repetição espaçada', pagina: true },
      { slug: 'simulados', icon: 'timer', titulo: 'Simulados', descricao: 'Treine cronometrado, com gabarito', pagina: true },
      { slug: 'desempenho', icon: 'chart', titulo: 'Desempenho e ranking', descricao: 'Veja sua evolução por área', pagina: true },
    ],
  },
  {
    id: 'residencia', nome: 'MedTrouxa Residência', icon: 'cap', tom: 'arcano',
    itens: [
      { slug: 'cronogramas', icon: 'calendar', titulo: 'Cronogramas', descricao: 'ENAMED, Residência e Internato', pagina: true },
      { slug: 'provas-na-integra', icon: 'doc', titulo: 'Provas na íntegra', descricao: 'Provas reais de residência', pagina: true },
      { slug: 'mapa-de-provas', icon: 'map', titulo: 'Mapa de provas', descricao: 'O que mais cai por banca', pagina: true },
      { slug: 'aprofundamento', icon: 'spark', titulo: 'Aprofundamento', descricao: 'Comentários além do gabarito', pagina: true },
    ],
  },
  {
    id: 'plus', nome: 'MedTrouxa Plus', icon: 'owl', tom: 'coruja',
    itens: [
      { slug: 'coruja-ia', icon: 'owl', titulo: 'Coruja IA', descricao: 'Sua tutora de medicina, 24h', pagina: true },
      { slug: 'flashcards-com-ia', icon: 'cards', titulo: 'Flashcards com IA', descricao: 'Cards gerados dos seus resumos', pagina: true },
    ],
  },
];

export const hrefRecurso = (r: Recurso) => (r.pagina ? `/recursos/${r.slug}` : '/#recursos');
