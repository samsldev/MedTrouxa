import { INestApplicationContext, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Testimonial } from './entities';

/**
 * DADOS DE TESTE da landing (números, aprovados e depoimentos fictícios).
 * Só ficam ativos com DEMO_CONTENT=true e fora de produção (NODE_ENV !== 'production').
 * Em produção, a API ignora tudo isto e mostra apenas dados reais.
 */
export const demoEnabled = () => process.env.DEMO_CONTENT === 'true' && process.env.NODE_ENV !== 'production';

export const DEMO_STATS = { questions: 48_000, flashcards: 320_000, answers: 2_400_000, students: 21_000, approved: 2_700 };

export const DEMO_APPROVED_NAMES = [
  'Lara Campos', 'Cleiton Siqueira', 'Emmily Carvalho', 'Guilherme Rios', 'Bianca Morais', 'Arthur Pinto', 'Yago Fonseca',
  'Fábio Nogueira', 'Breno Lima', 'Mariana Rocha', 'Heloísa Andrade', 'Fernanda Barros', 'Alane Soares', 'Ana Bispo',
  'Amanda Zamoner', 'Rafael Tavares', 'Júlia Menezes', 'Pedro Aguiar', 'Camila Duarte', 'Thiago Ramalho', 'Isabela Freitas',
  'Lucas Brandão', 'Beatriz Coelho', 'Matheus Viana', 'Letícia Prado', 'Gabriel Teixeira', 'Sofia Mendonça', 'Diego Paiva',
  'Larissa Queiroz', 'Vinícius Moura', 'Natália Fontes', 'Henrique Salles', 'Carolina Pires', 'Eduardo Lacerda', 'Marina Assis',
  'Rodrigo Bastos', 'Paula Cunha', 'Felipe Arruda', 'Juliana Macedo', 'Otávio Rezende',
];

const SAMPLE_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

const DEMO: Partial<Testimonial>[] = [
  { name: 'Daniela Almeida Brito', school: 'UFTM', featured: true, specialty: 'Dermatologia', institutions: 'IAMSPE, SES-GO e PSU',
    quote: 'O MedTrouxa me ensinou a ter prática e constância na resolução de questões, que foi a parte mais importante da minha preparação.' },
  { name: 'Glauco Stefan Vicenzi', school: 'UFPR', featured: true, specialty: 'Oftalmologia', institutions: 'IAMSPE',
    quote: 'Foi minha introdução ao método de estudo por questões, que usei até o final da preparação.' },
  { name: 'Júlio Melo Cordeiro', school: 'UNIFESP', featured: true, specialty: 'Oftalmologia', institutions: 'USP e UNIFESP',
    quote: 'A Coruja explicava exatamente o ponto que eu não tinha entendido. Era como ter um professor do lado o tempo todo.' },
  { name: 'Stevan Schulter Patel', school: 'UFSC', specialty: 'Oftalmologia', institutions: 'SUS-SP, HGCR, HRSJ e HOB',
    quote: 'Com o estudo ativo eu consegui fixar o conteúdo das aulas e criar o hábito de praticar questões e flashcards todos os dias.' },
  { name: 'Caio Bittencourt', school: 'UNIVALI', highlight: '93 pontos no ENAMED',
    quote: 'Consegui 93 pontos estudando com a plataforma. O cronograma me deu o mapa; eu só precisei seguir.' },
  { name: 'Débora Esteves Carvalho', school: 'UFMG', specialty: 'Ginecologia e Obstetrícia', institutions: 'Albert Einstein',
    quote: 'Usei durante a faculdade e foi meu primeiro contato com resolução de questões comentadas. Mudou minha forma de estudar.' },
  { name: 'Gabriela da Silva Nunes', school: 'UFBA', specialty: 'Neurologia', institutions: 'HMSJ e HCPA',
    quote: 'Os simulados cronometrados me deram ritmo de prova. Cheguei no dia sem ansiedade com o tempo.' },
  { name: 'Renan Kaufmann', school: 'UFRGS', specialty: 'Cirurgia Geral', institutions: 'HCPA',
    quote: 'Ver meu aproveitamento por área mostrou onde eu precisava insistir. Foi o que virou o jogo.' },
  { name: 'Danielle Brito', school: 'UFTM', videoUrl: SAMPLE_VIDEO, approved: false,
    quote: 'Aprendi a ter prática e constância na resolução de questões, que foi a parte mais importante da minha preparação.' },
  { name: 'Leôncio Castro', school: 'Universidade Federal do Oeste da Bahia', videoUrl: SAMPLE_VIDEO, approved: false,
    quote: 'Sabe quando alguém te pergunta o que é mais importante naquele assunto? É isso que a plataforma faz todo dia.' },
  { name: 'Murilo Figueiredo', school: 'UNIVALI', videoUrl: SAMPLE_VIDEO, approved: false,
    quote: 'Parei de ficar frustrado e comecei a lembrar mais do conteúdo entre os semestres. Caiu como uma luva.' },
  { name: 'Lívia Lara Guedes', school: 'UNIFAS/UNIME', videoUrl: SAMPLE_VIDEO, approved: false,
    quote: 'Com o acompanhamento de desempenho eu sei exatamente os pontos em que preciso me dedicar mais.' },
  { name: 'Otávio Rezende', school: 'UERJ', videoUrl: SAMPLE_VIDEO, approved: false,
    quote: 'Os flashcards com revisão espaçada salvaram meu internato. Revisar virou rotina de 15 minutos.' },
];

export async function seedDemoContent(app: INestApplicationContext) {
  if (!demoEnabled()) return;
  const repo = app.get(DataSource).getRepository(Testimonial);
  // Recria o conjunto de teste para refletir sempre a versão atual deste arquivo
  await repo.delete({ isDemo: true });
  await repo.save(DEMO.map((d) => repo.create({ ...d, isDemo: true, published: true, rating: 5 })));
  new Logger('Seed').log(`Dados de teste da landing ativos (${DEMO.length} depoimentos, números fictícios)`);
}
