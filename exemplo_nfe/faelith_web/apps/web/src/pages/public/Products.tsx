/**
 * @fileoverview Public products page with numbered feature rows for Code, CLI, Chat, and API.
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
 * - Explains each surface with an icon, description, and metering facts
 * - Chat is marketing only; there is no chat UI on this site
 * - Routes to Download and Pricing
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icons';
import { Reveal } from '../../components/Reveal';
import { useT, type Dict } from '../../lib/i18n';
import styles from './Marketing.module.css';

interface Product {
  icon: IconName;
  title: string;
  body: string;
  facts: string[];
}

interface ProductsStrings {
  kicker: string;
  title: [string, string];
  lede: string;
  products: Product[];
  install: string;
  compare: string;
}

const T: Dict<ProductsStrings> = {
  en: {
    kicker: 'Products',
    title: ['Wherever you work, ', 'it is already there.'],
    lede: 'Editor, terminal, chat, and API, all speaking to the same two model families with the same account and the same rate card. Code, CLI, and Chat share an included allowance, and the API runs on credits you prepaid. Nothing to configure twice.',
    products: [
      { icon: 'code', title: 'Code', body: 'The repository agent for people who ship. It reads the whole tree, proposes a diff, runs your tests, and explains every hunk before you accept a single line. Reviews, migrations, refactors that touch forty files: hand them over and stay the reviewer.', facts: ['Shares the Code/CLI 5-hour and weekly allowance', 'Echo and Horizon', 'ZDR inference provider'] },
      { icon: 'terminal', title: 'CLI', body: 'The same intelligence where your hands already are. One line to install, one command to log in, and any directory on any machine becomes a conversation with an agent that can read, edit, and run. Built for SSH, CI, and the 2 a.m. incident.', facts: ['Shares the Code/CLI meter', 'Unix and Windows installers', 'get.faelithindustries.com'] },
      { icon: 'chat', title: 'Chat', body: 'A place to think before you build. Chat shares the Code/CLI 5-hour and weekly pool, so design conversation and shipping draw from the same allowance.', facts: ['Shares the Code/CLI meter', 'Same 5-hour and weekly pool', 'Overage from prepaid credits'] },
      { icon: 'api', title: 'API', body: 'OpenAI-compatible Chat Completions. Change the base URL, keep your SDK, and put Echo or Horizon in production this afternoon. API keys bill only from prepaid credits, so your monthly spend is a number you set, never a surprise you receive.', facts: ['OpenAI-compatible', 'Prepaid credits only', 'Never touches plan allowance'] },
    ],
    install: 'Install in one line',
    compare: 'Compare plans',
  },
  br: {
    kicker: 'Produtos',
    title: ['Onde quer que você trabalhe, ', 'ele já está lá.'],
    lede: 'Editor, terminal, chat e API, todos falando com as mesmas duas famílias de modelos, na mesma conta e com a mesma tabela de preços. Code, CLI e Chat compartilham um limite incluído, e a API roda com créditos que você pagou antes. Nada para configurar duas vezes.',
    products: [
      { icon: 'code', title: 'Code', body: 'O agente de repositório para quem entrega. Ele lê a árvore inteira, propõe um diff, roda seus testes e explica cada trecho antes de você aceitar uma linha sequer. Revisões, migrações, refatorações que mexem em quarenta arquivos: entregue para ele e continue revisando.', facts: ['Compartilha o limite de 5 horas e semanal do Code/CLI', 'Echo e Horizon', 'Provedor de inferência ZDR'] },
      { icon: 'terminal', title: 'CLI', body: 'A mesma inteligência onde suas mãos já estão. Uma linha para instalar, um comando para entrar, e qualquer pasta em qualquer máquina vira uma conversa com um agente que lê, edita e executa. Feito para SSH, CI e o incidente das 2 da manhã.', facts: ['Compartilha o medidor Code/CLI', 'Instaladores para Unix e Windows', 'get.faelithindustries.com'] },
      { icon: 'chat', title: 'Chat', body: 'Um lugar para pensar antes de construir. O Chat compartilha o limite de 5 horas e semanal do Code/CLI, então a conversa de design e a entrega usam o mesmo limite.', facts: ['Compartilha o medidor Code/CLI', 'Mesmo limite de 5 horas e semanal', 'Excedente com créditos pré-pagos'] },
      { icon: 'api', title: 'API', body: 'Chat Completions compatível com OpenAI. Troque a base URL, mantenha seu SDK e coloque o Echo ou o Horizon em produção hoje à tarde. Chaves de API cobram só de créditos pré-pagos, então seu gasto mensal é um número que você define, nunca uma surpresa.', facts: ['Compatível com OpenAI', 'Somente créditos pré-pagos', 'Nunca usa o limite do plano'] },
    ],
    install: 'Instale com uma linha',
    compare: 'Comparar planos',
  },
  pt: {
    kicker: 'Produtos',
    title: ['Onde quer que trabalhe, ', 'ele já lá está.'],
    lede: 'Editor, terminal, chat e API, todos a falar com as mesmas duas famílias de modelos, na mesma conta e com a mesma tabela de preços. Code, CLI e Chat partilham um limite incluído, e a API funciona com créditos que pagou antecipadamente. Nada para configurar duas vezes.',
    products: [
      { icon: 'code', title: 'Code', body: 'O agente de repositório para quem entrega. Lê a árvore inteira, propõe um diff, corre os seus testes e explica cada excerto antes de aceitar uma única linha. Revisões, migrações, refatorações que mexem em quarenta ficheiros: entregue-lhas e continue a rever.', facts: ['Partilha o limite de 5 horas e semanal do Code/CLI', 'Echo e Horizon', 'Fornecedor de inferência ZDR'] },
      { icon: 'terminal', title: 'CLI', body: 'A mesma inteligência onde as suas mãos já estão. Uma linha para instalar, um comando para iniciar sessão, e qualquer pasta em qualquer máquina torna-se uma conversa com um agente que lê, edita e executa. Feito para SSH, CI e o incidente das 2 da manhã.', facts: ['Partilha o medidor Code/CLI', 'Instaladores para Unix e Windows', 'get.faelithindustries.com'] },
      { icon: 'chat', title: 'Chat', body: 'Um lugar para pensar antes de construir. O Chat partilha o limite de 5 horas e semanal do Code/CLI, por isso a conversa de design e a entrega usam o mesmo limite.', facts: ['Partilha o medidor Code/CLI', 'Mesmo limite de 5 horas e semanal', 'Excedente com créditos pré-pagos'] },
      { icon: 'api', title: 'API', body: 'Chat Completions compatível com OpenAI. Troque o base URL, mantenha o seu SDK e coloque o Echo ou o Horizon em produção esta tarde. As chaves de API cobram apenas de créditos pré-pagos, por isso o seu gasto mensal é um número que define, nunca uma surpresa.', facts: ['Compatível com OpenAI', 'Apenas créditos pré-pagos', 'Nunca usa o limite do plano'] },
    ],
    install: 'Instale com uma linha',
    compare: 'Comparar planos',
  },
};

/**
 * Public products marketing page.
 */
export function ProductsPage() {
  const t = useT(T);
  return (
    <div className="page">
      <header className={styles.pageHero}>
        <p className="kicker fade-up">{t.kicker}</p>
        <h1 className={`${styles.title} fade-up`} style={{ ['--delay' as string]: '80ms' }}>
          {t.title[0]}<span className="serif">{t.title[1]}</span>
        </h1>
        <p className="lede fade-up" style={{ ['--delay' as string]: '160ms' }}>
          {t.lede}
        </p>
      </header>

      <div className={styles.rows}>
        {t.products.map((product, index) => (
          <Reveal key={product.title} className={styles.row}>
            <span className={styles.rowIndex}>0{index + 1}</span>
            <div className={styles.rowHead}>
              <span className={styles.rowIcon}>
                <Icon name={product.icon} size={20} />
              </span>
              <h2>{product.title}</h2>
            </div>
            <div className={styles.rowBody}>
              <p>{product.body}</p>
              <div className={styles.rowFacts}>
                {product.facts.map((fact) => (
                  <span key={fact} className="badge">
                    {fact}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="btn-row" style={{ marginTop: 48 }}>
        <Link className="btn btn-primary" to="/download">
          {t.install}
          <Icon name="arrow" size={16} className="arrow" />
        </Link>
        <Link className="btn btn-ghost" to="/pricing">
          {t.compare}
        </Link>
      </div>
    </div>
  );
}
