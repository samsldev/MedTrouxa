import { INestApplicationContext, Logger } from '@nestjs/common';
import { isProd } from '../config/env';
import { hashPassword, passwordProblem } from '../security/password';
import { DataSource } from 'typeorm';
import { Deck, Flashcard, PlanItem, Question, StudyPlan, Subject, Topic, User } from './entities';

const SUBJECTS: Record<string, string[]> = {
  'Clínica Médica': ['Cardiologia', 'Endocrinologia', 'Pneumologia', 'Nefrologia', 'Infectologia'],
  'Cirurgia': ['Trauma (ATLS)', 'Abdome Agudo', 'Cirurgia Vascular'],
  'Pediatria': ['Neonatologia', 'Imunizações', 'Doenças Exantemáticas'],
  'Ginecologia e Obstetrícia': ['Pré-natal', 'Síndromes Hipertensivas', 'Oncoginecologia'],
  'Medicina Preventiva': ['Epidemiologia', 'SUS', 'Bioestatística'],
};

type Q = [topic: string, statement: string, alts: string[], correct: string, commentary: string, institution: string, year: number, difficulty: 'easy' | 'medium' | 'hard'];

const QUESTIONS: Q[] = [
  ['Cardiologia', 'Paciente de 58 anos, hipertenso, apresenta dor torácica em aperto há 40 minutos. ECG mostra supradesnivelamento de ST em V1–V4. O hospital não dispõe de hemodinâmica e a transferência levaria 3 horas. Qual a conduta?',
    ['Aguardar troponina para confirmar', 'Trombólise em até 30 minutos da chegada', 'Transferir para angioplastia primária', 'Iniciar apenas AAS e observar', 'Solicitar ecocardiograma antes de qualquer conduta'],
    'B', 'IAM com supra: se a angioplastia não puder ser feita em até 120 min do primeiro contato, indica-se fibrinólise com tempo porta-agulha ≤ 30 min. Não se aguarda troponina para decidir reperfusão.', 'ENAMED', 2025, 'medium'],
  ['Cardiologia', 'Qual droga reduz mortalidade na insuficiência cardíaca com fração de ejeção reduzida?',
    ['Digoxina', 'Furosemida', 'Espironolactona', 'Hidralazina isolada', 'Anlodipino'],
    'C', 'Antagonistas mineralocorticoides (espironolactona) reduzem mortalidade na ICFEr, junto com IECA/BRA/INRA, betabloqueadores e iSGLT2. Diuréticos de alça e digoxina melhoram sintomas, sem impacto em mortalidade.', 'USP-SP', 2024, 'easy'],
  ['Endocrinologia', 'Critério diagnóstico de diabetes mellitus:',
    ['Glicemia de jejum ≥ 110 mg/dL', 'HbA1c ≥ 6,5%', 'Glicemia pós-prandial ≥ 140 mg/dL', 'HbA1c ≥ 5,7%', 'Glicemia ao acaso ≥ 180 mg/dL sem sintomas'],
    'B', 'DM: jejum ≥ 126, TOTG 2h ≥ 200, HbA1c ≥ 6,5% (confirmados) ou glicemia ao acaso ≥ 200 com sintomas. HbA1c 5,7–6,4% é pré-diabetes.', 'UNIFESP', 2023, 'easy'],
  ['Endocrinologia', 'Na cetoacidose diabética, antes de iniciar insulina deve-se verificar:',
    ['Sódio sérico', 'Potássio sérico', 'Fósforo', 'Magnésio', 'Cálcio iônico'],
    'B', 'Se K < 3,3 mEq/L, repor potássio antes da insulina, pois esta desloca K para o intracelular e pode causar hipocalemia grave e arritmias.', 'SUS-SP', 2024, 'medium'],
  ['Pneumologia', 'Escore usado para decidir local de tratamento na pneumonia adquirida na comunidade:',
    ['Wells', 'CURB-65', 'CHA2DS2-VASc', 'Glasgow', 'Child-Pugh'],
    'B', 'CURB-65: Confusão, Ureia > 50, FR ≥ 30, PA < 90/60, idade ≥ 65. 0–1 ambulatorial; 2 considerar internação; ≥ 3 internação (avaliar UTI).', 'ENAMED', 2025, 'easy'],
  ['Nefrologia', 'Critério KDIGO que define lesão renal aguda:',
    ['Aumento da creatinina ≥ 0,3 mg/dL em 48h', 'Creatinina > 2 mg/dL', 'Diurese < 1 mL/kg/h por 6h', 'Ureia > 100', 'TFG < 60 por 1 mês'],
    'A', 'KDIGO: ↑ Cr ≥ 0,3 mg/dL em 48h, ou ≥ 1,5x basal em 7 dias, ou diurese < 0,5 mL/kg/h por 6h.', 'UNICAMP', 2023, 'medium'],
  ['Infectologia', 'Esquema básico para tuberculose pulmonar em adultos no Brasil:',
    ['2RHZ/4RH', '2RHZE/4RH', '2RHZE/7RH', '6RH', '2SHZE/4RH'],
    'B', 'Esquema básico (≥ 10 anos): 2 meses de RHZE (fase intensiva) + 4 meses de RH (manutenção).', 'SUS-SP', 2025, 'easy'],
  ['Trauma (ATLS)', 'No atendimento inicial ao politraumatizado, a primeira prioridade é:',
    ['Controle de hemorragia externa grave / via aérea com proteção cervical', 'Avaliação neurológica', 'Exposição', 'Acesso venoso', 'FAST'],
    'A', 'ATLS 11ª ed.: xABCDE — controle de hemorragia exsanguinante, depois via aérea com restrição de movimento da coluna cervical.', 'ENAMED', 2024, 'easy'],
  ['Abdome Agudo', 'Sinal de Blumberg positivo indica:',
    ['Colecistite', 'Irritação peritoneal (descompressão brusca dolorosa no ponto de McBurney)', 'Pancreatite', 'Obstrução intestinal', 'Diverticulite'],
    'B', 'Blumberg: dor à descompressão brusca no ponto de McBurney — irritação peritoneal, sugestivo de apendicite. Murphy é o da colecistite.', 'UFRJ', 2023, 'easy'],
  ['Cirurgia Vascular', 'Os 6 "P" da oclusão arterial aguda incluem, EXCETO:',
    ['Dor (pain)', 'Palidez', 'Ausência de pulso', 'Parestesia', 'Pletora'],
    'E', 'Os 6 P: pain, pallor, pulselessness, paresthesia, paralysis, poikilothermia. Pletora não faz parte.', 'USP-RP', 2024, 'medium'],
  ['Neonatologia', 'Recém-nascido a termo, apneico ao nascer. Após passos iniciais, a próxima conduta é:',
    ['Massagem cardíaca', 'Adrenalina', 'Ventilação com pressão positiva no 1º minuto de vida', 'Intubação imediata', 'Aspirar traqueia de rotina'],
    'C', 'SBP: RN que não respira ou FC < 100 após passos iniciais → VPP no "minuto de ouro". Massagem só se FC < 60 após VPP adequada.', 'ENAMED', 2025, 'medium'],
  ['Imunizações', 'Vacina aplicada ao nascer segundo o PNI:',
    ['Pentavalente e VIP', 'BCG e Hepatite B', 'Rotavírus', 'Tríplice viral', 'Febre amarela'],
    'B', 'Ao nascer: BCG (dose única) e hepatite B (preferencialmente nas primeiras 12–24h).', 'SUS-SP', 2023, 'easy'],
  ['Doenças Exantemáticas', 'Exantema súbito após 3 dias de febre alta que cessa, em lactente:',
    ['Sarampo', 'Rubéola', 'Roséola (HHV-6)', 'Escarlatina', 'Eritema infeccioso'],
    'C', 'Roséola (exantema súbito): febre alta por 3–5 dias; quando a febre cede, surge exantema maculopapular. Agente: HHV-6/7.', 'UNIFESP', 2024, 'easy'],
  ['Pré-natal', 'Suplementação de ácido fólico para prevenção de defeitos do tubo neural deve iniciar:',
    ['Na 12ª semana', 'Pelo menos 30 dias antes da concepção', 'No 2º trimestre', 'Apenas se houver anemia', 'Após o parto'],
    'B', 'Iniciar ao menos 30 dias antes da concepção e manter até a 12ª semana (0,4 mg/dia; 4–5 mg se alto risco).', 'ENAMED', 2024, 'easy'],
  ['Síndromes Hipertensivas', 'Droga de escolha para prevenção e tratamento de convulsão na pré-eclâmpsia grave:',
    ['Fenitoína', 'Diazepam', 'Sulfato de magnésio', 'Fenobarbital', 'Hidralazina'],
    'C', 'Sulfato de magnésio (Pritchard ou Zuspan). Monitorar reflexos patelares, diurese e FR; antídoto: gluconato de cálcio.', 'USP-SP', 2025, 'easy'],
  ['Oncoginecologia', 'Rastreamento do câncer de colo uterino no Brasil (citologia) é indicado para mulheres de:',
    ['18 a 60 anos', '25 a 64 anos que já iniciaram atividade sexual', 'Todas acima de 12 anos', '30 a 70 anos', 'Apenas com sintomas'],
    'B', 'INCA: 25 a 64 anos, após início da atividade sexual; dois exames anuais negativos → trienal. (Transição para teste DNA-HPV em curso.)', 'SUS-SP', 2024, 'medium'],
  ['Epidemiologia', 'Estudo que parte da exposição e acompanha indivíduos ao longo do tempo para verificar desfecho:',
    ['Caso-controle', 'Transversal', 'Coorte', 'Ecológico', 'Série de casos'],
    'C', 'Coorte: parte da exposição para o desfecho; permite calcular incidência e risco relativo. Caso-controle parte do desfecho (odds ratio).', 'ENAMED', 2025, 'easy'],
  ['SUS', 'Princípio doutrinário do SUS:',
    ['Descentralização', 'Regionalização', 'Equidade', 'Hierarquização', 'Participação popular'],
    'C', 'Doutrinários: universalidade, integralidade e equidade. Organizativos: descentralização, regionalização, hierarquização e participação social.', 'UFRJ', 2023, 'easy'],
  ['Bioestatística', 'Um teste com alta sensibilidade é ideal para:',
    ['Confirmar diagnóstico', 'Rastreamento (descartar doença quando negativo)', 'Reduzir falsos positivos', 'Aumentar o VPP em baixa prevalência', 'Estudos de coorte'],
    'B', 'SnNout: teste muito Sensível, quando Negativo, exclui (rule OUT). Específico positivo confirma (SpPin).', 'UNICAMP', 2024, 'medium'],
  ['Cardiologia', 'Na fibrilação atrial, CHA2DS2-VASc de 3 em mulher indica:',
    ['Nenhuma anticoagulação', 'AAS isolado', 'Anticoagulação oral', 'Apenas controle de frequência', 'Cardioversão imediata'],
    'C', 'Anticoagular se ≥ 2 em homens ou ≥ 3 em mulheres (sexo feminino soma 1 ponto). DOACs preferenciais, exceto estenose mitral moderada/grave ou prótese mecânica.', 'USP-SP', 2025, 'hard'],
];

const DECKS: { name: string; topic: string; cards: [string, string][] }[] = [
  { name: 'Cardio de bolso', topic: 'Cardiologia', cards: [
    ['Tempo porta-agulha no IAMCSST', '≤ 30 minutos'], ['Tempo porta-balão no IAMCSST', '≤ 90 minutos (≤ 120 se transferência)'],
    ['Drogas que reduzem mortalidade na ICFEr', 'IECA/BRA/INRA, betabloqueador, espironolactona, iSGLT2'],
    ['Onda T apiculada + QRS alargado', 'Hipercalemia'], ['Tríade de Beck', 'Hipotensão, turgência jugular, abafamento de bulhas (tamponamento)'] ] },
  { name: 'Pediatria essencial', topic: 'Imunizações', cards: [
    ['Vacinas ao nascer', 'BCG + Hepatite B'], ['Exantema após febre que cede', 'Roséola (HHV-6)'],
    ['FC para iniciar massagem no RN', '< 60 bpm após 30 s de VPP efetiva'], ['"Face esbofeteada"', 'Eritema infeccioso (Parvovírus B19)'] ] },
  { name: 'Preventiva sem sofrimento', topic: 'Epidemiologia', cards: [
    ['SnNout', 'Teste sensível negativo exclui a doença'], ['SpPin', 'Teste específico positivo confirma a doença'],
    ['Medida de associação da coorte', 'Risco relativo'], ['Medida de associação do caso-controle', 'Odds ratio'],
    ['Princípios doutrinários do SUS', 'Universalidade, integralidade, equidade'] ] },
];

function plan(goal: string, weeks: number, topics: Topic[]): PlanItem[] {
  const items: PlanItem[] = [];
  for (let d = 1; d <= weeks * 7; d++) {
    const t = topics[(d - 1) % topics.length];
    if (d % 7 === 0) items.push({ day: d, title: 'Simulado semanal + revisão dos erros', type: 'review' });
    else if (d % 2) items.push({ day: d, title: `${t.name}: 20 questões`, type: 'questions', topicId: t.id });
    else items.push({ day: d, title: `${t.name}: resumo + flashcards`, type: 'flashcards', topicId: t.id });
  }
  return items;
}

export async function seedIfEmpty(app: INestApplicationContext) {
  const db = app.get(DataSource);
  const log = new Logger('Seed');
  await ensureAdmin(app);
  // Conteúdo de exemplo (áreas, questões, baralhos, cronogramas). Em produção, só com SEED_SAMPLE_CONTENT=true.
  if (isProd() && process.env.SEED_SAMPLE_CONTENT !== 'true') return;
  if (await db.getRepository(Subject).count()) return;
  log.log('Banco vazio — populando dados iniciais...');
  await db.transaction(async (m) => {
    const topics = new Map<string, Topic>();
    for (const [name, ts] of Object.entries(SUBJECTS)) {
      const s = await m.save(m.create(Subject, { name }));
      for (const t of ts) topics.set(t, await m.save(m.create(Topic, { name: t, subjectId: s.id })));
    }
    await m.save(QUESTIONS.map(([topic, statement, alts, correctKey, commentary, institution, year, difficulty]) =>
      m.create(Question, {
        topicId: topics.get(topic)!.id, statement, correctKey, commentary, institution, year, difficulty,
        alternatives: alts.map((text, i) => ({ key: 'ABCDE'[i], text })),
      })));
    for (const d of DECKS) {
      const deck = await m.save(m.create(Deck, { name: d.name, topicId: topics.get(d.topic)!.id, ownerId: null }));
      await m.save(d.cards.map(([front, back]) => m.create(Flashcard, { deckId: deck.id, front, back })));
    }
    const all = [...topics.values()];
    await m.save([
      m.create(StudyPlan, { title: 'ENAMED em 8 semanas', goal: 'ENAMED', description: 'Revisão geral das 5 grandes áreas com simulados semanais.', items: plan('ENAMED', 8, all) }),
      m.create(StudyPlan, { title: 'Residência R1 — 12 semanas', goal: 'Residência', description: 'Foco em questões de provas de residência com revisão espaçada.', items: plan('Residência', 12, all) }),
      m.create(StudyPlan, { title: 'Clínica Médica intensivo (4 semanas)', goal: 'Faculdade', description: 'Para a prova do internato de clínica.', items: plan('Faculdade', 4, all.filter((t) => ['Cardiologia', 'Endocrinologia', 'Pneumologia', 'Nefrologia', 'Infectologia'].includes(t.name))) }),
    ]);
  });
  log.log('Conteúdo inicial criado');
}

/**
 * Cria/garante o admin a partir de ADMIN_EMAIL/ADMIN_PASSWORD (nunca uma senha fixa no código).
 * Em desenvolvimento, sem essas variáveis, usa um admin local de conveniência.
 */
export async function ensureAdmin(app: INestApplicationContext) {
  const repo = app.get(DataSource).getRepository(User);
  const log = new Logger('Seed');
  let email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  let password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    if (isProd()) { log.warn('ADMIN_EMAIL/ADMIN_PASSWORD não definidos: nenhum admin criado'); return; }
    email = 'admin@medtrouxa.dev'; password = 'Coruja#Dev2026';
  }
  const problem = passwordProblem(password, email);
  if (problem) { log.error(`ADMIN_PASSWORD fraca: ${problem}`); if (isProd()) process.exit(1); return; }
  const existing = await repo.findOneBy({ email });
  if (existing) { if (existing.role !== 'admin') await repo.update(existing.id, { role: 'admin' }); return; }
  await repo.save(repo.create({ name: 'Admin', email, role: 'admin', passwordHash: await hashPassword(password), termsAcceptedAt: new Date(), termsVersion: 'admin' }));
  log.log(`Admin criado: ${email}${isProd() ? '' : ` / ${password} (apenas desenvolvimento)`}`);
}
