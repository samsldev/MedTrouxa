/**
 * @fileoverview Public resources landing linking to Docs, Changelog, Status and data handling.
 * @author Samuel S. L.
 * @version 2.4.0
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
 * - Docs, Changelog, Status, and data-handling tiles with monospace metadata
 * - Marks unpublished content as in progress without dead links
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { Link } from 'react-router-dom';
import { Reveal } from '../../components/Reveal';
import { useT, type Dict } from '../../lib/i18n';
import styles from './Marketing.module.css';

interface Resource {
  title: string;
  body: string;
  meta: string;
  to: string | null;
}

interface ResourcesStrings {
  kicker: string;
  title: [string, string];
  lede: string;
  items: Resource[];
}

const T: Dict<ResourcesStrings> = {
  en: {
    kicker: 'Resources',
    title: ['Written for people who ', 'read the source.'],
    lede: 'No marketing in the docs, no docs in the marketing. Reference material, release notes, live status, and a data-handling page that says exactly what happens to your bytes.',
    items: [
      { title: 'Docs', body: 'API reference, CLI commands, data handling, and the exact billing rules. Written to be read once and trusted.', meta: 'Read the docs', to: '/docs' },
      { title: 'Changelog', body: 'Every release for Code, CLI, Chat, API, and model aliases, with what changed and why it matters to you.', meta: 'See releases', to: '/changelog' },
      { title: 'Status', body: 'Live uptime, incidents, and maintenance windows for the gateway and model fleet. No green checkmark without the data.', meta: 'Operational', to: null },
      { title: 'Data handling', body: 'How ZDR inference and encrypted Faelith-side S3 capture work, what is kept, and for how long.', meta: 'See Models', to: '/models' },
    ],
  },
  br: {
    kicker: 'Recursos',
    title: ['Escrito para quem ', 'lê o código-fonte.'],
    lede: 'Nada de marketing na documentação, nada de documentação no marketing. Material de referência, notas de versão, status ao vivo e uma página de tratamento de dados que diz exatamente o que acontece com os seus bytes.',
    items: [
      { title: 'Docs', body: 'Referência da API, comandos da CLI, tratamento de dados e as regras exatas de cobrança. Escritas para serem lidas uma vez e confiáveis.', meta: 'Ler a documentação', to: '/docs' },
      { title: 'Changelog', body: 'Cada versão do Code, CLI, Chat, API e aliases de modelos, com o que mudou e por que importa para você.', meta: 'Ver versões', to: '/changelog' },
      { title: 'Status', body: 'Disponibilidade ao vivo, incidentes e janelas de manutenção do gateway e da frota de modelos. Nenhum check verde sem os dados.', meta: 'Operacional', to: null },
      { title: 'Tratamento de dados', body: 'Como funcionam a inferência ZDR e a captura criptografada no S3 do Faelith, o que é guardado e por quanto tempo.', meta: 'Ver Modelos', to: '/models' },
    ],
  },
  pt: {
    kicker: 'Recursos',
    title: ['Escrito para quem ', 'lê o código-fonte.'],
    lede: 'Nada de marketing na documentação, nada de documentação no marketing. Material de referência, notas de versão, estado em tempo real e uma página de tratamento de dados que diz exatamente o que acontece aos seus bytes.',
    items: [
      { title: 'Docs', body: 'Referência da API, comandos da CLI, tratamento de dados e as regras exatas de faturação. Escritas para serem lidas uma vez e merecerem confiança.', meta: 'Ler a documentação', to: '/docs' },
      { title: 'Changelog', body: 'Todas as versões do Code, CLI, Chat, API e aliases de modelos, com o que mudou e porque lhe interessa.', meta: 'Ver versões', to: '/changelog' },
      { title: 'Estado', body: 'Disponibilidade em tempo real, incidentes e janelas de manutenção do gateway e da frota de modelos. Nenhum visto verde sem os dados.', meta: 'Operacional', to: null },
      { title: 'Tratamento de dados', body: 'Como funcionam a inferência ZDR e a captura cifrada no S3 do Faelith, o que é guardado e durante quanto tempo.', meta: 'Ver Modelos', to: '/models' },
    ],
  },
};

/**
 * Public resources landing; Docs and Changelog tiles link to their pages.
 */
export function ResourcesPage() {
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
      <div className={styles.resourceGrid}>
        {t.items.map((item, index) => (
          <Reveal key={item.title} delay={index * 60} className={`card ${styles.resource}`}>
            <h3>{item.to ? <Link to={item.to}>{item.title}</Link> : item.title}</h3>
            <p>{item.body}</p>
            {item.to ? (
              <Link to={item.to} className={styles.resourceMeta}>
                {item.meta}
              </Link>
            ) : (
              <span className={styles.resourceMeta}>{item.meta}</span>
            )}
          </Reveal>
        ))}
      </div>
    </div>
  );
}
