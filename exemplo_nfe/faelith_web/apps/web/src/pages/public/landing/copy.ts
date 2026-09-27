/**
 * @fileoverview Localized copy for the campaign landings: 2 products x 3 variants x 3 locales.
 * @author Samuel S. L.
 * @version 2.0.1
 * @since 2026-09-25
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 * All information contained herein is, and remains, the property of
 * Samuel S. L. and its suppliers, if any.
 *
 * The intellectual, technical, creative, and software concepts contained
 * herein are proprietary to Samuel S. L. and its suppliers and
 * are protected by copyright law, trade secret law, and other applicable
 * intellectual property laws in the Netherlands, the European Union, and
 * other foreign jurisdictions.
 *
 * Where applicable, such rights may be registered, recorded, or protected
 * with the competent authorities of the Government of the Netherlands,
 * the European Union, and/or other relevant jurisdictions.
 *
 * Dissemination of this information, reproduction of this material,
 * modification, distribution, disclosure, or commercial use is strictly
 * forbidden unless prior written permission is obtained from
 * Samuel S. L.
 *
 * @commercialUse Commercial use permitted only with prior written permission from Samuel S. L.
 *
 * DETAILED_DESCRIPTION:
 * - Products: `code` (CLI + desktop agent) and `chat` (Faelith Chat)
 * - Variants (same for both products):
 *   1 Outcome: cold paid traffic; promise-first split hero, full argument
 *   2 Problem: organic/search traffic; opens on the pain and a comparison table
 *   3 Demo: video traffic; demo-first hero, short page, fast CTA
 * - Product copy (sections) is shared by the variants; each variant owns its hero,
 *   CTA wording, and section order
 * - pt-PT uses European Portuguese vocabulary (equipa, ficheiros, subscrição, ecrã)
 * - Every claim maps to a real product rule: statutory refund window (7 days BR,
 *   14 days PT, none promised in EN), prepaid credits, ZDR upstream, plans from US$20
 */

import type { IconName } from '../../../components/Icons';

/** Landing locale slug used in the URL. */
export type LandingLocale = 'br' | 'pt' | 'en';
/** Product the landing sells. */
export type LandingProduct = 'code' | 'chat';
/** Creative angle of the landing. */
export type LandingVariant = '1' | '2' | '3';

/** Body sections a variant can order. */
export type LandingSection = 'pains' | 'compare' | 'steps' | 'features' | 'pricing' | 'faq';

/** One scripted exchange for the Chat demo. */
export interface ChatDemoScript {
  prompt: string;
  answer: string;
  placeholder: string;
}

/** Copy shared by every variant of one product in one locale. */
export interface ProductCopy {
  htmlLang: string;
  headerCta: string;
  guarantee: string | null;
  urgency: string;
  badges: string[];
  painsTitle: [string, string];
  pains: { before: string; after: string }[];
  compareTitle: [string, string];
  compareColumns: [string, string];
  compareRows: { label: string; us: boolean; them: boolean | 'partial' }[];
  stepsTitle: [string, string];
  steps: { title: string; body: string }[];
  install: string | null;
  featuresTitle: [string, string];
  features: { icon: IconName; title: string; body: string }[];
  pricingTitle: [string, string];
  pricingFrom: string;
  pricingPer: string;
  pricingPoints: string[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  finalTitle: [string, string];
  finalLede: string;
  stickyCta: string;
  chatDemo: ChatDemoScript | null;
}

/** Hero and flow of one variant. */
export interface VariantCopy {
  title: string;
  kicker: string;
  headline: [string, string];
  lede: string;
  primaryCta: string;
  ctaNote: string;
  /** `split`: copy left, demo right. `demo`: centered copy with a wide demo under it. */
  hero: 'split' | 'demo';
  sections: LandingSection[];
}

export interface LandingCopy extends ProductCopy, VariantCopy {}

const CHECK_ROWS_CODE = {
  en: ['Reads your whole repository', 'Edits files and runs your tests', 'Shows every diff before it lands', 'Zero data retention upstream', 'Prepaid, no surprise bills'],
  br: ['Lê o repositório inteiro', 'Edita arquivos e roda seus testes', 'Mostra cada diff antes de aplicar', 'Zero retenção de dados no provedor', 'Pré-pago, sem conta surpresa'],
  pt: ['Lê o repositório inteiro', 'Edita ficheiros e corre os seus testes', 'Mostra cada diff antes de aplicar', 'Zero retenção de dados no fornecedor', 'Pré-pago, sem faturas surpresa'],
};

const CHECK_ROWS_CHAT = {
  en: ['Frontier-grade models at full speed', 'Up to 1M tokens of context', 'Same allowance as Code and CLI', 'Zero data retention upstream', 'Prepaid, no surprise bills'],
  br: ['Modelos de ponta em velocidade total', 'Até 1M de tokens de contexto', 'Mesmo limite do Code e da CLI', 'Zero retenção de dados no provedor', 'Pré-pago, sem conta surpresa'],
  pt: ['Modelos de ponta em velocidade total', 'Até 1M de tokens de contexto', 'Mesmo limite do Code e da CLI', 'Zero retenção de dados no fornecedor', 'Pré-pago, sem faturas surpresa'],
};

/** Builds comparison rows: we check every row; the generic alternative only some. */
function rows(labels: string[], them: Array<boolean | 'partial'>) {
  return labels.map((label, index) => ({ label, us: true, them: them[index] ?? false }));
}

const PRODUCT: Record<LandingProduct, Record<LandingLocale, ProductCopy>> = {
  code: {
    en: {
      htmlLang: 'en',
      headerCta: 'Get started',
      guarantee: null,
      urgency: 'Set up in under 2 minutes. Cancel any time.',
      badges: ['Up to 1M tokens of context', 'Zero data retention upstream', 'Prepaid. No surprise bills.'],
      painsTitle: ['What changes on ', 'day one.'],
      pains: [
        { before: 'Hours lost reading unfamiliar code', after: 'Ask the repository and get the answer with the exact files' },
        { before: 'Copy-pasting between a chat tab and your editor', after: 'The agent edits the files, runs the tests and shows the diff' },
        { before: 'AI bills that arrive after the damage is done', after: 'A fixed plan, and credits only when you choose to spend them' },
      ],
      compareTitle: ['Not another ', 'autocomplete.'],
      compareColumns: ['Faelith', 'Chat-tab AI'],
      compareRows: rows(CHECK_ROWS_CODE.en, [false, false, false, 'partial', 'partial']),
      stepsTitle: ['From zero to your first commit in ', 'two minutes.'],
      steps: [
        { title: 'Install', body: 'One line in the terminal. Windows, macOS and Linux.' },
        { title: 'Log in', body: 'Approve the login in the browser. No keys to copy.' },
        { title: 'Hand it a task', body: '"Fix the failing test", "add pagination", "explain this module". Review and accept.' },
      ],
      install: 'curl -fsSL https://get.faelithindustries.com | sh',
      featuresTitle: ['One account. ', 'Every surface.'],
      features: [
        { icon: 'terminal', title: 'CLI', body: 'The full agent in your terminal: plan mode, parallel agents, sessions.' },
        { icon: 'code', title: 'Code', body: 'A desktop app that thinks in whole repositories and shows every hunk.' },
        { icon: 'chat', title: 'Chat', body: 'Think out loud on the same allowance, with the same models.' },
        { icon: 'api', title: 'API', body: 'OpenAI-compatible. Change the base URL, keep your code.' },
      ],
      pricingTitle: ['Less than one hour of a senior ', 'per month.'],
      pricingFrom: 'US$20',
      pricingPer: '/month',
      pricingPoints: ['CLI, Code and Chat included', '5-hour and weekly allowance', 'Echo and Horizon models', 'Cancel any time from the website'],
      faqTitle: 'Questions before you start',
      faq: [
        { q: 'How much does it cost?', a: 'Plans start at US$20 per month with a 5-hour and weekly allowance shared by CLI, Code and Chat. When it runs out you choose: stop, or spend prepaid credits.' },
        { q: 'Is my code used for training?', a: 'No. The inference provider runs with zero data retention. Faelith keeps an encrypted audit record for 90 days in its own storage.' },
        { q: 'Does it work with my stack?', a: 'If it runs in a terminal, the agent can read it, edit it and run it: any language, any framework, any build tool.' },
        { q: 'Can I cancel any time?', a: 'Yes, from the website in two clicks. Your plan stays active until the end of the period you paid for.' },
      ],
      finalTitle: ['Your next commit is ', 'one click away.'],
      finalLede: 'Create your account, install the CLI and hand the agent its first task today.',
      stickyCta: 'Start building',
      chatDemo: null,
    },
    br: {
      htmlLang: 'pt-BR',
      headerCta: 'Começar agora',
      guarantee: 'Garantia de 7 dias: não gostou, pede reembolso integral pelo site.',
      urgency: 'Configura em menos de 2 minutos. Cancela quando quiser.',
      badges: ['Até 1M de tokens de contexto', 'Zero retenção de dados no provedor', 'Pré-pago. Sem conta surpresa.'],
      painsTitle: ['O que muda já no ', 'primeiro dia.'],
      pains: [
        { before: 'Horas perdidas lendo código que você não conhece', after: 'Pergunte ao repositório e receba a resposta com os arquivos exatos' },
        { before: 'Copiar e colar entre a aba do chat e o editor', after: 'O agente edita os arquivos, roda os testes e mostra o diff' },
        { before: 'Fatura de IA que chega depois do estrago', after: 'Plano fixo, e créditos só quando você decidir gastar' },
      ],
      compareTitle: ['Não é mais um ', 'autocomplete.'],
      compareColumns: ['Faelith', 'IA na aba do chat'],
      compareRows: rows(CHECK_ROWS_CODE.br, [false, false, false, 'partial', 'partial']),
      stepsTitle: ['Do zero ao primeiro commit em ', 'dois minutos.'],
      steps: [
        { title: 'Instale', body: 'Uma linha no terminal. Windows, macOS e Linux.' },
        { title: 'Entre na conta', body: 'Aprove o login no navegador. Nenhuma chave para copiar.' },
        { title: 'Passe uma tarefa', body: '"Corrige o teste que está falhando", "adiciona paginação", "explica esse módulo". Revise e aceite.' },
      ],
      install: 'curl -fsSL https://get.faelithindustries.com | sh',
      featuresTitle: ['Uma conta. ', 'Todas as ferramentas.'],
      features: [
        { icon: 'terminal', title: 'CLI', body: 'O agente completo no terminal: plan mode, agentes em paralelo, sessões.' },
        { icon: 'code', title: 'Code', body: 'Um app desktop que pensa no repositório inteiro e mostra cada trecho.' },
        { icon: 'chat', title: 'Chat', body: 'Pense em voz alta com o mesmo limite e os mesmos modelos.' },
        { icon: 'api', title: 'API', body: 'Compatível com OpenAI. Troque a base URL e mantenha seu código.' },
      ],
      pricingTitle: ['Menos que uma hora de um sênior ', 'por mês.'],
      pricingFrom: 'US$ 20',
      pricingPer: '/mês',
      pricingPoints: ['CLI, Code e Chat incluídos', 'Limite de 5 horas e semanal', 'Modelos Echo e Horizon', '7 dias de garantia com reembolso integral'],
      faqTitle: 'Dúvidas antes de começar',
      faq: [
        { q: 'Quanto custa?', a: 'Os planos começam em US$ 20 por mês com limite de 5 horas e semanal, compartilhado entre CLI, Code e Chat. Quando acaba, você escolhe: parar ou usar créditos pré-pagos.' },
        { q: 'E se eu não gostar?', a: 'Na primeira assinatura você tem 7 dias para pedir reembolso integral direto pelo site, com um clique.' },
        { q: 'Meu código é usado para treinar a IA?', a: 'Não. O provedor de inferência opera com zero retenção de dados. O Faelith guarda um registro de auditoria criptografado por 90 dias no próprio armazenamento.' },
        { q: 'Funciona com a minha stack?', a: 'Se roda no terminal, o agente consegue ler, editar e executar: qualquer linguagem, framework ou ferramenta de build.' },
      ],
      finalTitle: ['Seu próximo commit está a ', 'um clique.'],
      finalLede: 'Crie sua conta, instale a CLI e passe a primeira tarefa para o agente hoje. Com 7 dias de garantia.',
      stickyCta: 'Começar agora',
      chatDemo: null,
    },
    pt: {
      htmlLang: 'pt-PT',
      headerCta: 'Começar agora',
      guarantee: 'Garantia de 14 dias: se não gostar, peça o reembolso total no site.',
      urgency: 'Configura em menos de 2 minutos. Cancele quando quiser.',
      badges: ['Até 1M de tokens de contexto', 'Zero retenção de dados no fornecedor', 'Pré-pago. Sem faturas surpresa.'],
      painsTitle: ['O que muda logo no ', 'primeiro dia.'],
      pains: [
        { before: 'Horas perdidas a ler código que não conhece', after: 'Pergunte ao repositório e receba a resposta com os ficheiros exatos' },
        { before: 'Copiar e colar entre o separador do chat e o editor', after: 'O agente edita os ficheiros, corre os testes e mostra o diff' },
        { before: 'Faturas de IA que chegam depois do estrago', after: 'Plano fixo, e créditos apenas quando decidir gastá-los' },
      ],
      compareTitle: ['Não é mais um ', 'autocomplete.'],
      compareColumns: ['Faelith', 'IA no separador do chat'],
      compareRows: rows(CHECK_ROWS_CODE.pt, [false, false, false, 'partial', 'partial']),
      stepsTitle: ['Do zero ao primeiro commit em ', 'dois minutos.'],
      steps: [
        { title: 'Instale', body: 'Uma linha no terminal. Windows, macOS e Linux.' },
        { title: 'Inicie sessão', body: 'Aprove o início de sessão no navegador. Nenhuma chave para copiar.' },
        { title: 'Atribua uma tarefa', body: '"Corrige o teste que está a falhar", "adiciona paginação", "explica este módulo". Reveja e aceite.' },
      ],
      install: 'curl -fsSL https://get.faelithindustries.com | sh',
      featuresTitle: ['Uma conta. ', 'Todas as ferramentas.'],
      features: [
        { icon: 'terminal', title: 'CLI', body: 'O agente completo no terminal: plan mode, agentes em paralelo, sessões.' },
        { icon: 'code', title: 'Code', body: 'Uma aplicação desktop que pensa no repositório inteiro e mostra cada excerto.' },
        { icon: 'chat', title: 'Chat', body: 'Pense em voz alta com o mesmo limite e os mesmos modelos.' },
        { icon: 'api', title: 'API', body: 'Compatível com OpenAI. Troque o base URL e mantenha o seu código.' },
      ],
      pricingTitle: ['Menos do que uma hora de um sénior ', 'por mês.'],
      pricingFrom: '20 USD',
      pricingPer: '/mês',
      pricingPoints: ['CLI, Code e Chat incluídos', 'Limite de 5 horas e semanal', 'Modelos Echo e Horizon', '14 dias de garantia com reembolso total'],
      faqTitle: 'Dúvidas antes de começar',
      faq: [
        { q: 'Quanto custa?', a: 'Os planos começam em 20 USD por mês com limite de 5 horas e semanal, partilhado entre CLI, Code e Chat. Quando acaba, escolhe: parar ou usar créditos pré-pagos.' },
        { q: 'E se não gostar?', a: 'Na primeira subscrição tem 14 dias para pedir o reembolso total diretamente no site, com um clique.' },
        { q: 'O meu código é usado para treinar a IA?', a: 'Não. O fornecedor de inferência opera com zero retenção de dados. O Faelith guarda um registo de auditoria cifrado durante 90 dias no seu próprio armazenamento.' },
        { q: 'Funciona com a minha stack?', a: 'Se corre no terminal, o agente consegue ler, editar e executar: qualquer linguagem, framework ou ferramenta de build.' },
      ],
      finalTitle: ['O seu próximo commit está a ', 'um clique.'],
      finalLede: 'Crie a sua conta, instale a CLI e atribua hoje a primeira tarefa ao agente. Com 14 dias de garantia.',
      stickyCta: 'Começar agora',
      chatDemo: null,
    },
  },
  chat: {
    en: {
      htmlLang: 'en',
      headerCta: 'Try Faelith Chat',
      guarantee: null,
      urgency: 'Ready in 30 seconds. Cancel any time.',
      badges: ['Up to 1M tokens of context', 'Zero data retention upstream', 'Prepaid. No surprise bills.'],
      painsTitle: ['Everything a good chat should be. ', 'Nothing it should not.'],
      pains: [
        { before: 'Answers that sound right but skip the reasoning', after: 'Horizon thinks the hard ones through before it answers' },
        { before: 'Pasting a long document and losing half of it', after: 'Up to 1M tokens of context: the whole document, in one go' },
        { before: 'Wondering where your conversations end up', after: 'Zero data retention at the inference provider' },
      ],
      compareTitle: ['A chat built like ', 'infrastructure.'],
      compareColumns: ['Faelith Chat', 'Typical AI chat'],
      compareRows: rows(CHECK_ROWS_CHAT.en, ['partial', false, false, 'partial', 'partial']),
      stepsTitle: ['Your first answer in ', 'thirty seconds.'],
      steps: [
        { title: 'Create your account', body: 'Email or Google/GitHub. No card needed to sign up.' },
        { title: 'Pick a plan', body: 'From US$20 per month, with the allowance shared by every Faelith surface.' },
        { title: 'Ask anything', body: 'Writing, analysis, studies, code. Pick Echo for speed or Horizon for depth.' },
      ],
      install: null,
      featuresTitle: ['Two models. ', 'One chat.'],
      features: [
        { icon: 'bolt', title: 'Echo', body: 'Fast answers for the everyday: drafts, summaries, quick questions.' },
        { icon: 'chat', title: 'Horizon', body: 'Deep reasoning for the hard ones: analysis, strategy, complex code.' },
        { icon: 'shield', title: 'Private by design', body: 'ZDR at the inference provider; your chats are not a training set.' },
        { icon: 'wallet', title: 'One allowance', body: 'The same plan covers Chat, CLI and Code. No second subscription.' },
      ],
      pricingTitle: ['Everything included, ', 'one price.'],
      pricingFrom: 'US$20',
      pricingPer: '/month',
      pricingPoints: ['Chat, CLI and Code included', '5-hour and weekly allowance', 'Echo and Horizon models', 'Cancel any time from the website'],
      faqTitle: 'Questions before you start',
      faq: [
        { q: 'How much does it cost?', a: 'Plans start at US$20 per month with a 5-hour and weekly allowance shared by Chat, CLI and Code.' },
        { q: 'Are my conversations used for training?', a: 'No. The inference provider runs with zero data retention. Faelith keeps an encrypted audit record for 90 days in its own storage.' },
        { q: 'What is the difference between Echo and Horizon?', a: 'Echo is tuned for speed; Horizon reasons longer before it answers. Switch per message.' },
        { q: 'Can I cancel any time?', a: 'Yes, from the website in two clicks. Your plan stays active until the end of the period you paid for.' },
      ],
      finalTitle: ['Ask your first question ', 'today.'],
      finalLede: 'Create your account and get your first answer in less than a minute.',
      stickyCta: 'Try Faelith Chat',
      chatDemo: {
        prompt: 'Summarize this 80-page contract and flag the risky clauses.',
        answer: 'Three clauses need attention: automatic renewal with a 90-day notice window (section 4.2), unlimited liability for data incidents (7.1), and exclusivity that also covers your affiliates (9.3). The rest is standard.',
        placeholder: 'Ask Faelith anything',
      },
    },
    br: {
      htmlLang: 'pt-BR',
      headerCta: 'Testar o Faelith Chat',
      guarantee: 'Garantia de 7 dias: não gostou, pede reembolso integral pelo site.',
      urgency: 'Pronto em 30 segundos. Cancela quando quiser.',
      badges: ['Até 1M de tokens de contexto', 'Zero retenção de dados no provedor', 'Pré-pago. Sem conta surpresa.'],
      painsTitle: ['Tudo que um bom chat deveria ser. ', 'Nada do que não deveria.'],
      pains: [
        { before: 'Respostas que parecem certas mas pulam o raciocínio', after: 'O Horizon pensa nas perguntas difíceis antes de responder' },
        { before: 'Colar um documento longo e perder metade', after: 'Até 1M de tokens de contexto: o documento inteiro, de uma vez' },
        { before: 'Não saber para onde vão as suas conversas', after: 'Zero retenção de dados no provedor de inferência' },
      ],
      compareTitle: ['Um chat feito como ', 'infraestrutura.'],
      compareColumns: ['Faelith Chat', 'Chat de IA comum'],
      compareRows: rows(CHECK_ROWS_CHAT.br, ['partial', false, false, 'partial', 'partial']),
      stepsTitle: ['Sua primeira resposta em ', 'trinta segundos.'],
      steps: [
        { title: 'Crie sua conta', body: 'E-mail ou Google/GitHub. Sem cartão para se cadastrar.' },
        { title: 'Escolha um plano', body: 'A partir de US$ 20 por mês, com o limite compartilhado por todo o Faelith.' },
        { title: 'Pergunte qualquer coisa', body: 'Textos, análises, estudos, código. Echo para velocidade, Horizon para profundidade.' },
      ],
      install: null,
      featuresTitle: ['Dois modelos. ', 'Um chat.'],
      features: [
        { icon: 'bolt', title: 'Echo', body: 'Respostas rápidas para o dia a dia: rascunhos, resumos, dúvidas.' },
        { icon: 'chat', title: 'Horizon', body: 'Raciocínio profundo para o difícil: análise, estratégia, código complexo.' },
        { icon: 'shield', title: 'Privado de verdade', body: 'ZDR no provedor de inferência; suas conversas não viram base de treino.' },
        { icon: 'wallet', title: 'Um limite só', body: 'O mesmo plano cobre Chat, CLI e Code. Nada de segunda assinatura.' },
      ],
      pricingTitle: ['Tudo incluído, ', 'um preço.'],
      pricingFrom: 'US$ 20',
      pricingPer: '/mês',
      pricingPoints: ['Chat, CLI e Code incluídos', 'Limite de 5 horas e semanal', 'Modelos Echo e Horizon', '7 dias de garantia com reembolso integral'],
      faqTitle: 'Dúvidas antes de começar',
      faq: [
        { q: 'Quanto custa?', a: 'Os planos começam em US$ 20 por mês com limite de 5 horas e semanal, compartilhado entre Chat, CLI e Code.' },
        { q: 'E se eu não gostar?', a: 'Na primeira assinatura você tem 7 dias para pedir reembolso integral direto pelo site, com um clique.' },
        { q: 'Minhas conversas são usadas para treinar a IA?', a: 'Não. O provedor de inferência opera com zero retenção de dados. O Faelith guarda um registro de auditoria criptografado por 90 dias no próprio armazenamento.' },
        { q: 'Qual a diferença entre Echo e Horizon?', a: 'O Echo é ajustado para velocidade; o Horizon raciocina mais antes de responder. Você troca a cada mensagem.' },
      ],
      finalTitle: ['Faça sua primeira pergunta ', 'hoje.'],
      finalLede: 'Crie sua conta e receba a primeira resposta em menos de um minuto. Com 7 dias de garantia.',
      stickyCta: 'Testar o Faelith Chat',
      chatDemo: {
        prompt: 'Resume esse contrato de 80 páginas e aponta as cláusulas de risco.',
        answer: 'Três cláusulas pedem atenção: renovação automática com aviso de 90 dias (seção 4.2), responsabilidade ilimitada por incidentes de dados (7.1) e exclusividade que também cobre suas afiliadas (9.3). O resto é padrão.',
        placeholder: 'Pergunte qualquer coisa ao Faelith',
      },
    },
    pt: {
      htmlLang: 'pt-PT',
      headerCta: 'Experimentar o Faelith Chat',
      guarantee: 'Garantia de 14 dias: se não gostar, peça o reembolso total no site.',
      urgency: 'Pronto em 30 segundos. Cancele quando quiser.',
      badges: ['Até 1M de tokens de contexto', 'Zero retenção de dados no fornecedor', 'Pré-pago. Sem faturas surpresa.'],
      painsTitle: ['Tudo o que um bom chat deve ser. ', 'Nada do que não deve.'],
      pains: [
        { before: 'Respostas que parecem certas mas saltam o raciocínio', after: 'O Horizon pensa nas perguntas difíceis antes de responder' },
        { before: 'Colar um documento longo e perder metade', after: 'Até 1M de tokens de contexto: o documento inteiro, de uma vez' },
        { before: 'Não saber para onde vão as suas conversas', after: 'Zero retenção de dados no fornecedor de inferência' },
      ],
      compareTitle: ['Um chat construído como ', 'infraestrutura.'],
      compareColumns: ['Faelith Chat', 'Chat de IA comum'],
      compareRows: rows(CHECK_ROWS_CHAT.pt, ['partial', false, false, 'partial', 'partial']),
      stepsTitle: ['A sua primeira resposta em ', 'trinta segundos.'],
      steps: [
        { title: 'Crie a sua conta', body: 'E-mail ou Google/GitHub. Sem cartão para se registar.' },
        { title: 'Escolha um plano', body: 'A partir de 20 USD por mês, com o limite partilhado por todo o Faelith.' },
        { title: 'Pergunte o que quiser', body: 'Textos, análises, estudos, código. Echo para rapidez, Horizon para profundidade.' },
      ],
      install: null,
      featuresTitle: ['Dois modelos. ', 'Um chat.'],
      features: [
        { icon: 'bolt', title: 'Echo', body: 'Respostas rápidas para o dia a dia: rascunhos, resumos, dúvidas.' },
        { icon: 'chat', title: 'Horizon', body: 'Raciocínio profundo para o difícil: análise, estratégia, código complexo.' },
        { icon: 'shield', title: 'Privado a sério', body: 'ZDR no fornecedor de inferência; as suas conversas não servem de treino.' },
        { icon: 'wallet', title: 'Um só limite', body: 'O mesmo plano cobre Chat, CLI e Code. Sem segunda subscrição.' },
      ],
      pricingTitle: ['Tudo incluído, ', 'um preço.'],
      pricingFrom: '20 USD',
      pricingPer: '/mês',
      pricingPoints: ['Chat, CLI e Code incluídos', 'Limite de 5 horas e semanal', 'Modelos Echo e Horizon', '14 dias de garantia com reembolso total'],
      faqTitle: 'Dúvidas antes de começar',
      faq: [
        { q: 'Quanto custa?', a: 'Os planos começam em 20 USD por mês com limite de 5 horas e semanal, partilhado entre Chat, CLI e Code.' },
        { q: 'E se não gostar?', a: 'Na primeira subscrição tem 14 dias para pedir o reembolso total diretamente no site, com um clique.' },
        { q: 'As minhas conversas são usadas para treinar a IA?', a: 'Não. O fornecedor de inferência opera com zero retenção de dados. O Faelith guarda um registo de auditoria cifrado durante 90 dias no seu próprio armazenamento.' },
        { q: 'Qual é a diferença entre Echo e Horizon?', a: 'O Echo está afinado para rapidez; o Horizon raciocina mais antes de responder. Troca a cada mensagem.' },
      ],
      finalTitle: ['Faça a sua primeira pergunta ', 'hoje.'],
      finalLede: 'Crie a sua conta e receba a primeira resposta em menos de um minuto. Com 14 dias de garantia.',
      stickyCta: 'Experimentar o Faelith Chat',
      chatDemo: {
        prompt: 'Resume este contrato de 80 páginas e assinala as cláusulas de risco.',
        answer: 'Há três cláusulas a rever: renovação automática com aviso prévio de 90 dias (secção 4.2), responsabilidade ilimitada por incidentes de dados (7.1) e exclusividade que abrange também as suas afiliadas (9.3). O resto é padrão.',
        placeholder: 'Pergunte o que quiser ao Faelith',
      },
    },
  },
};

const FULL: LandingSection[] = ['pains', 'steps', 'compare', 'features', 'pricing', 'faq'];
const PROBLEM: LandingSection[] = ['compare', 'pains', 'features', 'pricing', 'faq'];
const DEMO: LandingSection[] = ['steps', 'features', 'pricing', 'faq'];

const VARIANT: Record<LandingProduct, Record<LandingVariant, Record<LandingLocale, VariantCopy>>> = {
  code: {
    '1': {
      en: { title: 'Faelith | Ship like the whole team is senior', kicker: 'For developers who ship', headline: ['Stop typing code. Start ', 'shipping it.'], lede: 'An AI agent that reads your whole repository, writes the diff, runs your tests and explains every change before you accept it.', primaryCta: 'Start building now', ctaNote: 'Plans from US$20/month', hero: 'split', sections: FULL },
      br: { title: 'Faelith | Programe como se o time inteiro fosse sênior', kicker: 'Para quem programa e entrega', headline: ['Pare de digitar código. Comece a ', 'entregar.'], lede: 'Um agente de IA que lê o seu repositório inteiro, escreve o diff, roda os seus testes e explica cada mudança antes de você aceitar.', primaryCta: 'Quero começar agora', ctaNote: 'Planos a partir de US$ 20/mês', hero: 'split', sections: FULL },
      pt: { title: 'Faelith | Programe como se a equipa inteira fosse sénior', kicker: 'Para quem programa e entrega', headline: ['Deixe de escrever código. Comece a ', 'entregá-lo.'], lede: 'Um agente de IA que lê o seu repositório inteiro, escreve o diff, corre os seus testes e explica cada alteração antes de a aceitar.', primaryCta: 'Quero começar agora', ctaNote: 'Planos a partir de 20 USD/mês', hero: 'split', sections: FULL },
    },
    '2': {
      en: { title: 'Faelith | The AI that actually finishes the task', kicker: 'Tired of copy-paste AI?', headline: ['Your AI suggests. Faelith ', 'finishes.'], lede: 'Chat-tab assistants hand you snippets and leave the rest to you. Faelith opens the files, makes the change, runs the tests and only stops when it is green.', primaryCta: 'Let the agent do the work', ctaNote: 'Plans from US$20/month', hero: 'split', sections: PROBLEM },
      br: { title: 'Faelith | A IA que termina a tarefa', kicker: 'Cansou de IA de copiar e colar?', headline: ['Sua IA sugere. O Faelith ', 'termina.'], lede: 'Assistentes na aba do chat entregam trechos e deixam o resto com você. O Faelith abre os arquivos, faz a mudança, roda os testes e só para quando está verde.', primaryCta: 'Deixar o agente trabalhar', ctaNote: 'Planos a partir de US$ 20/mês', hero: 'split', sections: PROBLEM },
      pt: { title: 'Faelith | A IA que termina a tarefa', kicker: 'Farto de IA de copiar e colar?', headline: ['A sua IA sugere. O Faelith ', 'termina.'], lede: 'Os assistentes no separador do chat entregam excertos e deixam o resto consigo. O Faelith abre os ficheiros, faz a alteração, corre os testes e só para quando está verde.', primaryCta: 'Deixar o agente trabalhar', ctaNote: 'Planos a partir de 20 USD/mês', hero: 'split', sections: PROBLEM },
    },
    '3': {
      en: { title: 'Faelith | See the agent work', kicker: 'You saw it in the video', headline: ['Now try it on ', 'your code.'], lede: 'The same agent, in your terminal, on your repository. Install in one line and hand it the first task in two minutes.', primaryCta: 'Try it on my repository', ctaNote: 'Plans from US$20/month', hero: 'demo', sections: DEMO },
      br: { title: 'Faelith | Veja o agente trabalhando', kicker: 'Você viu no vídeo', headline: ['Agora teste no ', 'seu código.'], lede: 'O mesmo agente, no seu terminal, no seu repositório. Instale com uma linha e passe a primeira tarefa em dois minutos.', primaryCta: 'Testar no meu repositório', ctaNote: 'Planos a partir de US$ 20/mês', hero: 'demo', sections: DEMO },
      pt: { title: 'Faelith | Veja o agente a trabalhar', kicker: 'Viu no vídeo', headline: ['Agora experimente no ', 'seu código.'], lede: 'O mesmo agente, no seu terminal, no seu repositório. Instale com uma linha e atribua a primeira tarefa em dois minutos.', primaryCta: 'Experimentar no meu repositório', ctaNote: 'Planos a partir de 20 USD/mês', hero: 'demo', sections: DEMO },
    },
  },
  chat: {
    '1': {
      en: { title: 'Faelith Chat | The answer, not the small talk', kicker: 'Faelith Chat', headline: ['The AI chat that ', 'thinks first.'], lede: 'Two frontier-grade models, up to 1M tokens of context and zero data retention upstream. For work that deserves a real answer.', primaryCta: 'Try Faelith Chat', ctaNote: 'Plans from US$20/month', hero: 'split', sections: FULL },
      br: { title: 'Faelith Chat | A resposta, não o papo', kicker: 'Faelith Chat', headline: ['O chat de IA que ', 'pensa antes.'], lede: 'Dois modelos de ponta, até 1M de tokens de contexto e zero retenção de dados no provedor. Para o trabalho que merece uma resposta de verdade.', primaryCta: 'Testar o Faelith Chat', ctaNote: 'Planos a partir de US$ 20/mês', hero: 'split', sections: FULL },
      pt: { title: 'Faelith Chat | A resposta, não a conversa', kicker: 'Faelith Chat', headline: ['O chat de IA que ', 'pensa primeiro.'], lede: 'Dois modelos de ponta, até 1M de tokens de contexto e zero retenção de dados no fornecedor. Para o trabalho que merece uma resposta a sério.', primaryCta: 'Experimentar o Faelith Chat', ctaNote: 'Planos a partir de 20 USD/mês', hero: 'split', sections: FULL },
    },
    '2': {
      en: { title: 'Faelith Chat | Private by design', kicker: 'Where do your chats go?', headline: ['Your ideas are not a ', 'training set.'], lede: 'Most AI chats blur the line between your conversations and their data. Faelith runs on zero data retention upstream and keeps its own audit record encrypted.', primaryCta: 'Chat privately', ctaNote: 'Plans from US$20/month', hero: 'split', sections: PROBLEM },
      br: { title: 'Faelith Chat | Privado por padrão', kicker: 'Para onde vão suas conversas?', headline: ['Suas ideias não são ', 'base de treino.'], lede: 'A maioria dos chats de IA mistura suas conversas com os dados deles. O Faelith roda com zero retenção de dados no provedor e guarda o próprio registro de auditoria criptografado.', primaryCta: 'Conversar com privacidade', ctaNote: 'Planos a partir de US$ 20/mês', hero: 'split', sections: PROBLEM },
      pt: { title: 'Faelith Chat | Privado por defeito', kicker: 'Para onde vão as suas conversas?', headline: ['As suas ideias não são ', 'material de treino.'], lede: 'A maioria dos chats de IA mistura as suas conversas com os dados deles. O Faelith funciona com zero retenção de dados no fornecedor e guarda o próprio registo de auditoria cifrado.', primaryCta: 'Conversar com privacidade', ctaNote: 'Planos a partir de 20 USD/mês', hero: 'split', sections: PROBLEM },
    },
    '3': {
      en: { title: 'Faelith Chat | See it answer', kicker: 'You saw it in the video', headline: ['Now ask it ', 'your question.'], lede: 'The same chat, the same models, on your own documents and ideas. Your first answer is less than a minute away.', primaryCta: 'Ask my first question', ctaNote: 'Plans from US$20/month', hero: 'demo', sections: DEMO },
      br: { title: 'Faelith Chat | Veja ele respondendo', kicker: 'Você viu no vídeo', headline: ['Agora faça a ', 'sua pergunta.'], lede: 'O mesmo chat, os mesmos modelos, nos seus documentos e ideias. Sua primeira resposta está a menos de um minuto.', primaryCta: 'Fazer minha primeira pergunta', ctaNote: 'Planos a partir de US$ 20/mês', hero: 'demo', sections: DEMO },
      pt: { title: 'Faelith Chat | Veja-o a responder', kicker: 'Viu no vídeo', headline: ['Agora faça a ', 'sua pergunta.'], lede: 'O mesmo chat, os mesmos modelos, nos seus documentos e ideias. A sua primeira resposta está a menos de um minuto.', primaryCta: 'Fazer a minha primeira pergunta', ctaNote: 'Planos a partir de 20 USD/mês', hero: 'demo', sections: DEMO },
    },
  },
};

/** Full copy for one landing page. */
export function landingCopy(product: LandingProduct, variant: LandingVariant, locale: LandingLocale): LandingCopy {
  return { ...PRODUCT[product][locale], ...VARIANT[product][variant][locale] };
}

/**
 * Picks the landing locale from the browser languages: Brazil and Portugal get their
 * Portuguese variant, any other `pt-*` falls back to pt-BR, everyone else gets English.
 */
export function detectLandingLocale(languages: readonly string[]): LandingLocale {
  for (const raw of languages) {
    const tag = raw.toLowerCase();
    if (tag === 'pt-pt') return 'pt';
    if (tag.startsWith('pt')) return 'br';
    if (tag.startsWith('en')) return 'en';
  }
  return 'en';
}

/** Narrows a URL segment to a landing locale. */
export function isLandingLocale(value: string | undefined): value is LandingLocale {
  return value === 'br' || value === 'pt' || value === 'en';
}

/** Narrows a URL segment to a landing product. */
export function isLandingProduct(value: string | undefined): value is LandingProduct {
  return value === 'code' || value === 'chat';
}

/** Narrows a URL segment to a landing variant. */
export function isLandingVariant(value: string | undefined): value is LandingVariant {
  return value === '1' || value === '2' || value === '3';
}
