/**
 * @fileoverview Marketing home: cinematic hero, live CLI replay, model ticker, bento, and CTA band.
 * @author Samuel S. L.
 * @version 2.5.1
 * @since 2026-09-06
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
 * - Two-column hero with serif-accented headline and a faithful Faelith Code CLI replay
 * - Infinite ticker of model aliases and platform guarantees
 * - Bento grid surfacing Code, CLI, Chat, API with spotlight hover
 * - Numeric proof strip driven from the public rate card
 * - Principles section (ZDR upstream, prepaid, one account) and closing CTA band
 * - Localized (en, pt-BR, pt-PT); every claim maps to a documented product rule
 */

import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icons';
import { Reveal } from '../../components/Reveal';
import { TerminalDemo } from '../../components/TerminalDemo';
import { formatUsdRate } from '../../lib/format';
import { useT, type Dict } from '../../lib/i18n';
import { listModelRates } from '../../lib/plans';
import { useSpotlight } from '../../lib/useSpotlight';
import styles from './Home.module.css';

interface Pillar {
  icon: IconName;
  title: string;
  body: string;
  span: 'wide' | 'std';
  meta: string;
}

interface Principle {
  icon: IconName;
  title: string;
  body: string;
}

interface HomeStrings {
  heroTitle: [string, string];
  heroLede: string;
  install: string;
  seePlans: string;
  badges: [string, string, string];
  pillars: Pillar[];
  ticker: string[];
  productsKicker: string;
  productsTitle: [string, string, string];
  productsLede: string;
  explore: (name: string) => string;
  proofEcho: string;
  proofHorizon: string;
  proofContext: string;
  proofZdr: string;
  principlesKicker: string;
  principlesTitle: [string, string, string];
  principlesLede: string;
  principles: Principle[];
  ctaKicker: string;
  ctaTitle: [string, string, string];
  ctaLede: string;
  ctaInstall: string;
  ctaCompare: string;
}

const T: Dict<HomeStrings> = {
  en: {
    heroTitle: ['Ship like the whole team is ', 'senior.'],
    heroLede:
      'Faelith puts two production-grade models, Echo and Horizon, inside your editor, your terminal, your chat, and your API. Prepaid credits. ZDR inference. One account that follows you from the first commit to the last deploy.',
    install: 'Install in one line',
    seePlans: 'See plans',
    badges: ['No free tier, no throttling', '256k and 1M context', 'ZDR upstream'],
    pillars: [
      { icon: 'code', title: 'Code', body: 'An agent that lives in your editor and thinks in whole repositories. It reads the tree, proposes the diff, runs your tests, and explains every hunk before you accept it. You stay the reviewer. It does the typing.', span: 'wide', meta: 'Shares the Code/CLI allowance' },
      { icon: 'terminal', title: 'CLI', body: 'The same intelligence where you already live. One line to install, one command to log in, and every repository on your machine becomes a conversation.', span: 'std', meta: 'get.faelithindustries.com' },
      { icon: 'chat', title: 'Chat', body: 'Think out loud on the same 5-hour and weekly pool as Code and CLI. One allowance, every surface that ships.', span: 'std', meta: 'Shares Code/CLI meter' },
      { icon: 'api', title: 'API', body: 'OpenAI-compatible Chat Completions with a new base URL and nothing else to change. Billed from credits you already own, so production traffic is a number you set, not a surprise you receive.', span: 'wide', meta: 'Drop-in compatible' },
    ],
    ticker: ['echo', 'echo1m', 'horizon', 'horizon1m', '256k context', '1M context', 'ZDR inference provider', 'Prepaid. No surprises.', 'OpenAI-compatible', 'Encrypted Faelith capture', 'No free tier. No throttled tier.'],
    productsKicker: 'Products',
    productsTitle: ['Four surfaces. ', 'One', ' intelligence.'],
    productsLede:
      'Most tools make you choose between the editor, the terminal, and the API, then bill you three times. Faelith is one account, one rate card, and one model family behind every surface. Pick where you want to work. The intelligence is already there.',
    explore: (name) => `Explore ${name}`,
    proofEcho: 'Echo input per 1M tokens. Fast enough to forget it is there.',
    proofHorizon: 'Horizon input per 1M tokens. Reasoning for the hard ones.',
    proofContext: 'Tokens of context. Your monorepo, in one breath.',
    proofZdr: 'At the inference provider. Faelith capture stays encrypted in our S3.',
    principlesKicker: 'Principles',
    principlesTitle: ['Built like infrastructure. ', 'Priced', ' like a utility.'],
    principlesLede:
      'You would not accept a database that trains on your rows or a cloud that bills you after the fact. We do not think an AI should get a pass either.',
    principles: [
      { icon: 'shield', title: 'Zero data retention at the inference provider.', body: 'The upstream inference provider is ZDR. Faelith retains complete encrypted model I/O and chat transcripts in its own S3 for 90 days so tool calls, file reads, grep results, and responses remain auditable.' },
      { icon: 'wallet', title: 'You will never get a bill you did not choose.', body: 'Every plan includes a generous allowance. When it runs out you decide: hard-stop, or spend credits you already prepaid. There is no free plan, no throttled tier, and no invoice that arrives before you agreed to it.' },
      { icon: 'bolt', title: 'One account. Every surface. Same intelligence.', body: 'Editor, terminal, chat, and API all speak to the same two model families at the same list card. Keys carry a purpose, credits follow you, and nothing has to be configured twice.' },
    ],
    ctaKicker: 'Get started',
    ctaTitle: ['Your next commit is ', 'one line', ' away.'],
    ctaLede: 'Install, log in, and hand the agent a task in under two minutes. Plans start at $20 a month. Nothing is charged before you choose it.',
    ctaInstall: 'Install the CLI',
    ctaCompare: 'Compare plans',
  },
  br: {
    heroTitle: ['Entregue como se o time inteiro fosse ', 'sênior.'],
    heroLede:
      'O Faelith coloca dois modelos de nível de produção, Echo e Horizon, no seu editor, no seu terminal, no seu chat e na sua API. Créditos pré-pagos. Inferência ZDR. Uma conta que acompanha você do primeiro commit ao último deploy.',
    install: 'Instale com uma linha',
    seePlans: 'Ver planos',
    badges: ['Sem plano grátis, sem limitação de velocidade', 'Contexto de 256k e 1M', 'ZDR no provedor'],
    pillars: [
      { icon: 'code', title: 'Code', body: 'Um agente que vive no seu editor e pensa no repositório inteiro. Ele lê a árvore, propõe o diff, roda seus testes e explica cada trecho antes de você aceitar. Você continua revisando. Ele digita.', span: 'wide', meta: 'Compartilha o limite Code/CLI' },
      { icon: 'terminal', title: 'CLI', body: 'A mesma inteligência onde você já trabalha. Uma linha para instalar, um comando para entrar, e cada repositório da sua máquina vira uma conversa.', span: 'std', meta: 'get.faelithindustries.com' },
      { icon: 'chat', title: 'Chat', body: 'Pense em voz alta usando o mesmo limite de 5 horas e semanal do Code e da CLI. Um limite só, em todas as ferramentas.', span: 'std', meta: 'Compartilha o medidor Code/CLI' },
      { icon: 'api', title: 'API', body: 'Chat Completions compatível com OpenAI: troque a base URL e mais nada. Cobrado dos créditos que você já tem, então o tráfego de produção é um número que você define, não uma surpresa que você recebe.', span: 'wide', meta: 'Compatível sem mudanças' },
    ],
    ticker: ['echo', 'echo1m', 'horizon', 'horizon1m', 'Contexto de 256k', 'Contexto de 1M', 'Provedor de inferência ZDR', 'Pré-pago. Sem surpresas.', 'Compatível com OpenAI', 'Captura Faelith criptografada', 'Sem plano grátis. Sem plano limitado.'],
    productsKicker: 'Produtos',
    productsTitle: ['Quatro ferramentas. ', 'Uma', ' inteligência.'],
    productsLede:
      'A maioria das ferramentas faz você escolher entre editor, terminal e API, e depois cobra três vezes. O Faelith é uma conta, uma tabela de preços e uma família de modelos por trás de tudo. Escolha onde quer trabalhar. A inteligência já está lá.',
    explore: (name) => `Conhecer o ${name}`,
    proofEcho: 'Input do Echo por 1M de tokens. Rápido a ponto de você esquecer que está lá.',
    proofHorizon: 'Input do Horizon por 1M de tokens. Raciocínio para os casos difíceis.',
    proofContext: 'Tokens de contexto. Seu monorepo, de uma vez.',
    proofZdr: 'No provedor de inferência. A captura Faelith fica criptografada no nosso S3.',
    principlesKicker: 'Princípios',
    principlesTitle: ['Construído como infraestrutura. ', 'Cobrado', ' como serviço essencial.'],
    principlesLede:
      'Você não aceitaria um banco de dados que treina com as suas linhas nem uma nuvem que cobra depois do fato. Achamos que uma IA também não deve ganhar esse passe livre.',
    principles: [
      { icon: 'shield', title: 'Zero retenção de dados no provedor de inferência.', body: 'O provedor de inferência opera com ZDR. O Faelith guarda o I/O completo dos modelos e as transcrições de chat, criptografados, no próprio S3 por 90 dias, para que chamadas de ferramentas, leituras de arquivos, resultados de grep e respostas continuem auditáveis.' },
      { icon: 'wallet', title: 'Você nunca vai receber uma conta que não escolheu.', body: 'Todo plano inclui um limite generoso. Quando acaba, você decide: parar, ou usar créditos que já pagou. Não existe plano grátis, nem plano limitado, nem fatura que chega antes de você concordar.' },
      { icon: 'bolt', title: 'Uma conta. Todas as ferramentas. A mesma inteligência.', body: 'Editor, terminal, chat e API falam com as mesmas duas famílias de modelos, pela mesma tabela de preços. As chaves têm finalidade, os créditos acompanham você e nada precisa ser configurado duas vezes.' },
    ],
    ctaKicker: 'Comece agora',
    ctaTitle: ['Seu próximo commit está a ', 'uma linha', ' de distância.'],
    ctaLede: 'Instale, entre e passe uma tarefa para o agente em menos de dois minutos. Planos a partir de US$ 20 por mês. Nada é cobrado antes de você escolher.',
    ctaInstall: 'Instalar a CLI',
    ctaCompare: 'Comparar planos',
  },
  pt: {
    heroTitle: ['Entregue como se a equipa inteira fosse ', 'sénior.'],
    heroLede:
      'O Faelith coloca dois modelos de nível de produção, Echo e Horizon, no seu editor, no seu terminal, no seu chat e na sua API. Créditos pré-pagos. Inferência ZDR. Uma conta que o acompanha do primeiro commit ao último deploy.',
    install: 'Instale com uma linha',
    seePlans: 'Ver planos',
    badges: ['Sem plano gratuito, sem limitação de velocidade', 'Contexto de 256k e 1M', 'ZDR no fornecedor'],
    pillars: [
      { icon: 'code', title: 'Code', body: 'Um agente que vive no seu editor e pensa no repositório inteiro. Lê a árvore, propõe o diff, corre os seus testes e explica cada excerto antes de o aceitar. Continua a ser o revisor. Ele escreve.', span: 'wide', meta: 'Partilha o limite Code/CLI' },
      { icon: 'terminal', title: 'CLI', body: 'A mesma inteligência onde já trabalha. Uma linha para instalar, um comando para iniciar sessão, e cada repositório da sua máquina torna-se uma conversa.', span: 'std', meta: 'get.faelithindustries.com' },
      { icon: 'chat', title: 'Chat', body: 'Pense em voz alta com o mesmo limite de 5 horas e semanal do Code e da CLI. Um só limite, em todas as ferramentas.', span: 'std', meta: 'Partilha o medidor Code/CLI' },
      { icon: 'api', title: 'API', body: 'Chat Completions compatível com OpenAI: troque o base URL e mais nada. Cobrado dos créditos que já tem, por isso o tráfego de produção é um número que define, não uma surpresa que recebe.', span: 'wide', meta: 'Compatível sem alterações' },
    ],
    ticker: ['echo', 'echo1m', 'horizon', 'horizon1m', 'Contexto de 256k', 'Contexto de 1M', 'Fornecedor de inferência ZDR', 'Pré-pago. Sem surpresas.', 'Compatível com OpenAI', 'Captura Faelith cifrada', 'Sem plano gratuito. Sem plano limitado.'],
    productsKicker: 'Produtos',
    productsTitle: ['Quatro ferramentas. ', 'Uma', ' inteligência.'],
    productsLede:
      'A maioria das ferramentas obriga-o a escolher entre editor, terminal e API, e depois cobra três vezes. O Faelith é uma conta, uma tabela de preços e uma família de modelos por trás de tudo. Escolha onde quer trabalhar. A inteligência já lá está.',
    explore: (name) => `Conhecer o ${name}`,
    proofEcho: 'Input do Echo por 1M de tokens. Tão rápido que se esquece que lá está.',
    proofHorizon: 'Input do Horizon por 1M de tokens. Raciocínio para os casos difíceis.',
    proofContext: 'Tokens de contexto. O seu monorepo, de uma só vez.',
    proofZdr: 'No fornecedor de inferência. A captura Faelith fica cifrada no nosso S3.',
    principlesKicker: 'Princípios',
    principlesTitle: ['Construído como infraestrutura. ', 'Cobrado', ' como um serviço essencial.'],
    principlesLede:
      'Não aceitaria uma base de dados que treina com as suas linhas nem uma cloud que cobra depois do facto. Achamos que uma IA também não deve ter esse passe livre.',
    principles: [
      { icon: 'shield', title: 'Zero retenção de dados no fornecedor de inferência.', body: 'O fornecedor de inferência opera com ZDR. O Faelith guarda o I/O completo dos modelos e as transcrições de chat, cifrados, no seu próprio S3 durante 90 dias, para que chamadas de ferramentas, leituras de ficheiros, resultados de grep e respostas se mantenham auditáveis.' },
      { icon: 'wallet', title: 'Nunca vai receber uma fatura que não escolheu.', body: 'Todos os planos incluem um limite generoso. Quando acaba, decide: parar, ou usar créditos que já pagou. Não há plano gratuito, nem plano limitado, nem fatura que chega antes de concordar.' },
      { icon: 'bolt', title: 'Uma conta. Todas as ferramentas. A mesma inteligência.', body: 'Editor, terminal, chat e API falam com as mesmas duas famílias de modelos, pela mesma tabela de preços. As chaves têm finalidade, os créditos acompanham-no e nada tem de ser configurado duas vezes.' },
    ],
    ctaKicker: 'Comece já',
    ctaTitle: ['O seu próximo commit está a ', 'uma linha', ' de distância.'],
    ctaLede: 'Instale, inicie sessão e atribua uma tarefa ao agente em menos de dois minutos. Planos a partir de 20 USD por mês. Nada é cobrado antes de escolher.',
    ctaInstall: 'Instalar a CLI',
    ctaCompare: 'Comparar planos',
  },
};

/**
 * Formats a USD list rate for the proof strip.
 */
function rate(value: number): string {
  return formatUsdRate(value);
}

/**
 * Public landing page for Faelith Industries.
 */
export function HomePage() {
  const t = useT(T);
  const spotlight = useSpotlight();
  const echo = listModelRates().find((row) => row.id === 'echo');
  const horizon = listModelRates().find((row) => row.id === 'horizon');

  return (
    <div className={styles.root}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.gridBg} aria-hidden="true" />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className="kicker fade-up">Faelith Industries</p>
          <h1 className={`${styles.headline} fade-up`} style={{ ['--delay' as string]: '80ms' }}>
            {t.heroTitle[0]}<span className="serif">{t.heroTitle[1]}</span>
          </h1>
          <p className={`lede fade-up`} style={{ ['--delay' as string]: '160ms' }}>
            {t.heroLede}
          </p>
          <div className={`btn-row fade-up`} style={{ ['--delay' as string]: '240ms' }}>
            <Link className="btn btn-primary" to="/download">
              {t.install}
              <Icon name="arrow" size={16} className="arrow" />
            </Link>
            <Link className="btn btn-ghost" to="/pricing">
              {t.seePlans}
            </Link>
          </div>
          <div className={`${styles.heroMeta} fade-up`} style={{ ['--delay' as string]: '320ms' }}>
            <span className="badge">{t.badges[0]}</span>
            <span className="badge">{t.badges[1]}</span>
            <span className="badge badge-accent">{t.badges[2]}</span>
          </div>
        </div>
        <div className={`${styles.heroVisual} fade-up`} style={{ ['--delay' as string]: '200ms' }}>
          <TerminalDemo />
          <div className={styles.orbit} aria-hidden="true" />
        </div>
      </section>

      <div className={styles.ticker} aria-hidden="true">
        <div className={styles.tickerTrack}>
          {[...t.ticker, ...t.ticker].map((item, index) => (
            <span key={`${item}-${index}`} className={styles.tickerItem}>
              {item}
              <span className={styles.tickerDot} />
            </span>
          ))}
        </div>
      </div>

      <section className={styles.section}>
        <Reveal className="section-head">
          <p className="kicker">{t.productsKicker}</p>
          <h2 className="section-title">
            {t.productsTitle[0]}<span className="serif">{t.productsTitle[1]}</span>{t.productsTitle[2]}
          </h2>
          <p className="lede">{t.productsLede}</p>
        </Reveal>
        <div className={styles.bento}>
          {t.pillars.map((pillar, index) => (
            <Reveal
              key={pillar.title}
              as={Link}
              to="/products"
              delay={index * 70}
              className={`card ${styles.tile} ${styles[pillar.span]}`}
            >
              <div onPointerMove={spotlight} className={styles.tileInner}>
                <div className={styles.tileTop}>
                  <span className={styles.tileIcon}>
                    <Icon name={pillar.icon} size={18} />
                  </span>
                  <span className={styles.tileMeta}>{pillar.meta}</span>
                </div>
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
                <span className={styles.tileLink}>
                  {t.explore(pillar.title)}
                  <Icon name="arrow" size={14} />
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <Reveal className={styles.proof}>
          <div className={styles.proofItem}>
            <span className={styles.proofValue}>{echo ? rate(echo.inputUsd) : '—'}</span>
            <span className={styles.proofLabel}>{t.proofEcho}</span>
          </div>
          <div className={styles.proofItem}>
            <span className={styles.proofValue}>{horizon ? rate(horizon.inputUsd) : '—'}</span>
            <span className={styles.proofLabel}>{t.proofHorizon}</span>
          </div>
          <div className={styles.proofItem}>
            <span className={styles.proofValue}>1M</span>
            <span className={styles.proofLabel}>{t.proofContext}</span>
          </div>
          <div className={styles.proofItem}>
            <span className={styles.proofValue}>ZDR</span>
            <span className={styles.proofLabel}>{t.proofZdr}</span>
          </div>
        </Reveal>
      </section>

      <section className={styles.section}>
        <Reveal className="section-head">
          <p className="kicker">{t.principlesKicker}</p>
          <h2 className="section-title">
            {t.principlesTitle[0]}<span className="serif">{t.principlesTitle[1]}</span>{t.principlesTitle[2]}
          </h2>
          <p className="lede">{t.principlesLede}</p>
        </Reveal>
        <div className={styles.principles}>
          {t.principles.map((item, index) => (
            <Reveal key={item.title} delay={index * 90} className={styles.principle}>
              <span className={styles.principleIcon}>
                <Icon name={item.icon} size={20} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <Reveal className={styles.ctaBand}>
          <div className={styles.ctaGlow} aria-hidden="true" />
          <p className="kicker">{t.ctaKicker}</p>
          <h2 className={styles.ctaTitle}>
            {t.ctaTitle[0]}<span className="serif">{t.ctaTitle[1]}</span>{t.ctaTitle[2]}
          </h2>
          <code className={styles.ctaCode}>curl -fsSL https://get.faelithindustries.com | sh</code>
          <p className="lede" style={{ textAlign: 'center', fontSize: 15 }}>
            {t.ctaLede}
          </p>
          <div className="btn-row">
            <Link className="btn btn-primary" to="/download">
              {t.ctaInstall}
              <Icon name="arrow" size={16} className="arrow" />
            </Link>
            <Link className="btn btn-ghost" to="/pricing">
              {t.ctaCompare}
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
