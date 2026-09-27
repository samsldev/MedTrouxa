import { INestApplicationContext, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Testimonial } from './entities';

/**
 * Conteúdo de DEMONSTRAÇÃO para visualizar a prova social da landing em desenvolvimento.
 * Pessoas fictícias, marcadas com isDemo=true e exibidas com o selo "Exemplo".
 * Nunca roda com NODE_ENV=production, e a API também as esconde em produção.
 * Substitua por depoimentos reais (com autorização de uso de imagem) via POST /api/public/testimonials.
 */
const DEMO: Partial<Testimonial>[] = [
  { name: 'Aluna Exemplo A', school: 'Faculdade de Medicina (exemplo)', featured: true, specialty: 'Dermatologia', institutions: 'Instituição X e Y',
    quote: 'Resolver questões todos os dias virou hábito. Os comentários e os flashcards fizeram o conteúdo finalmente ficar.' },
  { name: 'Aluno Exemplo B', school: 'Universidade Federal (exemplo)', featured: true, specialty: 'Oftalmologia', institutions: 'Instituição Z',
    quote: 'Foi minha porta de entrada para o estudo por questões, e usei o método até o fim da preparação.' },
  { name: 'Aluno Exemplo C', school: 'Universidade Estadual (exemplo)', featured: true, specialty: 'Clínica Médica', institutions: 'Instituição W',
    quote: 'A Coruja explica exatamente o ponto que eu não tinha entendido. Parece ter um professor do lado.' },
  { name: 'Aluna Exemplo D', school: 'Centro Universitário (exemplo)', highlight: 'Resultado de exemplo no ENAMED',
    quote: 'O cronograma tirou o peso de decidir o que estudar. Eu só abria e seguia o dia.' },
  { name: 'Aluno Exemplo E', school: 'Faculdade de Medicina (exemplo)', specialty: 'Pediatria',
    quote: 'Os simulados cronometrados me deram ritmo de prova. Cheguei no dia sem ansiedade com o tempo.' },
  { name: 'Aluna Exemplo F', school: 'Universidade Federal (exemplo)', specialty: 'Ginecologia e Obstetrícia',
    quote: 'Ver o aproveitamento por área mostrou onde eu precisava insistir. Foi o que virou o jogo.' },
  { name: 'Aluno Exemplo G', school: 'Universidade Estadual (exemplo)', approved: false,
    quote: 'Uso desde o ciclo básico. Revisar pelos flashcards antes das provas da faculdade mudou minhas notas.' },
];

export async function seedDemoContent(app: INestApplicationContext) {
  if (process.env.NODE_ENV === 'production' || process.env.DEMO_CONTENT !== 'true') return;
  const repo = app.get(DataSource).getRepository(Testimonial);
  if (await repo.existsBy({ isDemo: true })) return;
  await repo.save(DEMO.map((d) => repo.create({ ...d, isDemo: true, published: true, rating: 5 })));
  new Logger('Seed').log(`Conteúdo de demonstração criado (${DEMO.length} depoimentos de exemplo)`);
}
