/**
 * @fileoverview Public model catalog, rate table, and data-handling policy.
 * @author Samuel S. L.
 * @version 2.5.0
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
 * - Side-by-side family cards with 256k list rates pulled from the catalog
 * - Monospace rate table for all four aliases
 * - ZDR inference and Faelith encrypted capture explained precisely
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { Icon } from '../../components/Icons';
import { Reveal } from '../../components/Reveal';
import { formatUsdRate } from '../../lib/format';
import { useT, type Dict } from '../../lib/i18n';
import { listModelRates, type ModelRateRow } from '../../lib/plans';
import styles from './Marketing.module.css';

interface ModelsStrings {
  kicker: string;
  title: [string, string, string];
  lede: string;
  echoTag: string;
  echoBody: string;
  horizonTag: string;
  horizonBody: string;
  inputLabel: string;
  outputLabel: string;
  cardKicker: string;
  cardTitle: [string, string, string];
  cardLede: string;
  cols: [string, string, string, string, string, string, string, string];
  dataKicker: string;
  dataTitle: [string, string];
  dataLede: string;
  zdrBadge: string;
  zdrTitle: string;
  zdrBody: string;
  captureBadge: string;
  captureTitle: string;
  captureBody: string;
}

const T: Dict<ModelsStrings> = {
  en: {
    kicker: 'Models',
    title: ['Two models. ', 'Zero', ' guesswork.'],
    lede: 'Echo when you need speed. Horizon when you need depth. Both in 256k and 1M context, both on one transparent rate card, both through a ZDR inference provider. You pick the model; the price is never a mystery.',
    echoTag: 'Family 01 · fast',
    echoBody: 'The model you reach for a hundred times a day. Low latency, dense output, and the lowest list price in the catalog. Autocomplete-fast for the small things, careful enough for the medium ones.',
    horizonTag: 'Family 02 · reasoning',
    horizonBody: 'The model for the problem that has been open for three days. Long-horizon reasoning across dozens of files, hard debugging, and migrations you would not trust to anyone junior. Its own list card, not a multiple of Echo.',
    inputLabel: 'input / 1M · 256k',
    outputLabel: 'output / 1M · 256k',
    cardKicker: 'Rate card',
    cardTitle: ['The whole card. ', 'Four', ' lines.'],
    cardLede: 'No tiers within tiers, no regional multipliers, no fine print. The 1M aliases (echo1m, horizon1m) cost 1.25× their 256k counterparts. Code/CLI and API prepaid debit this same published list card.',
    cols: ['Alias', 'Family', 'Window', 'Cache read / 1M', 'Write 5m / 1M', 'Write 1h / 1M', 'Input / 1M', 'Output / 1M'],
    dataKicker: 'Data handling',
    dataTitle: ['Your code stays ', 'yours.'],
    dataLede: 'The inference provider is zero data retention. Faelith keeps its own encrypted, access-controlled record of complete model I/O and the complete chat transcript.',
    zdrBadge: 'ZDR upstream',
    zdrTitle: 'No provider-side retention.',
    zdrBody: 'The inference provider processes the request without retaining it. There is one rate card for every key; data handling never changes the price.',
    captureBadge: 'Encrypted Faelith capture',
    captureTitle: 'Complete I/O retained for 90 days.',
    captureBody: 'Faelith stores the exact model input and output plus the complete transcript in its own S3. This includes system and tool messages, tool calls, file reads, writes, grep results, retries, reasoning output, and assistant responses.',
  },
  br: {
    kicker: 'Modelos',
    title: ['Dois modelos. ', 'Zero', ' adivinhação.'],
    lede: 'Echo quando você precisa de velocidade. Horizon quando precisa de profundidade. Os dois com contexto de 256k e 1M, os dois na mesma tabela de preços transparente, os dois por um provedor de inferência ZDR. Você escolhe o modelo; o preço nunca é um mistério.',
    echoTag: 'Família 01 · rápido',
    echoBody: 'O modelo que você usa cem vezes por dia. Baixa latência, resposta densa e o menor preço de lista do catálogo. Rápido como autocomplete nas coisas pequenas, cuidadoso o bastante nas médias.',
    horizonTag: 'Família 02 · raciocínio',
    horizonBody: 'O modelo para o problema que está aberto há três dias. Raciocínio longo por dezenas de arquivos, depuração difícil e migrações que você não confiaria a ninguém júnior. Tabela de preços própria, não um múltiplo do Echo.',
    inputLabel: 'input / 1M · 256k',
    outputLabel: 'output / 1M · 256k',
    cardKicker: 'Tabela de preços',
    cardTitle: ['A tabela inteira. ', 'Quatro', ' linhas.'],
    cardLede: 'Sem níveis dentro de níveis, sem multiplicadores regionais, sem letras miúdas. Os aliases 1M (echo1m, horizon1m) custam 1,25× os equivalentes de 256k. Code/CLI e o pré-pago da API debitam desta mesma tabela publicada.',
    cols: ['Alias', 'Família', 'Janela', 'Cache read / 1M', 'Write 5m / 1M', 'Write 1h / 1M', 'Input / 1M', 'Output / 1M'],
    dataKicker: 'Tratamento de dados',
    dataTitle: ['Seu código continua ', 'seu.'],
    dataLede: 'O provedor de inferência opera com zero retenção de dados. O Faelith mantém o próprio registro, criptografado e com acesso controlado, do I/O completo dos modelos e da transcrição completa do chat.',
    zdrBadge: 'ZDR no provedor',
    zdrTitle: 'Nenhuma retenção no provedor.',
    zdrBody: 'O provedor de inferência processa a requisição sem guardá-la. Existe uma tabela de preços para toda chave; o tratamento de dados nunca muda o preço.',
    captureBadge: 'Captura Faelith criptografada',
    captureTitle: 'I/O completo guardado por 90 dias.',
    captureBody: 'O Faelith guarda o input e o output exatos do modelo e a transcrição completa no próprio S3. Isso inclui mensagens de sistema e de ferramentas, chamadas de ferramentas, leituras e escritas de arquivos, resultados de grep, novas tentativas, raciocínio e respostas do assistente.',
  },
  pt: {
    kicker: 'Modelos',
    title: ['Dois modelos. ', 'Zero', ' adivinhação.'],
    lede: 'Echo quando precisa de rapidez. Horizon quando precisa de profundidade. Ambos com contexto de 256k e 1M, ambos na mesma tabela de preços transparente, ambos através de um fornecedor de inferência ZDR. Escolhe o modelo; o preço nunca é um mistério.',
    echoTag: 'Família 01 · rápido',
    echoBody: 'O modelo que usa cem vezes por dia. Baixa latência, resposta densa e o preço de tabela mais baixo do catálogo. Rápido como o autocomplete nas coisas pequenas, cuidadoso o suficiente nas médias.',
    horizonTag: 'Família 02 · raciocínio',
    horizonBody: 'O modelo para o problema que está em aberto há três dias. Raciocínio longo através de dezenas de ficheiros, depuração difícil e migrações que não confiaria a ninguém júnior. Tabela de preços própria, não um múltiplo do Echo.',
    inputLabel: 'input / 1M · 256k',
    outputLabel: 'output / 1M · 256k',
    cardKicker: 'Tabela de preços',
    cardTitle: ['A tabela completa. ', 'Quatro', ' linhas.'],
    cardLede: 'Sem níveis dentro de níveis, sem multiplicadores regionais, sem letras pequenas. Os aliases 1M (echo1m, horizon1m) custam 1,25× os equivalentes de 256k. Code/CLI e o pré-pago da API debitam desta mesma tabela publicada.',
    cols: ['Alias', 'Família', 'Janela', 'Cache read / 1M', 'Write 5m / 1M', 'Write 1h / 1M', 'Input / 1M', 'Output / 1M'],
    dataKicker: 'Tratamento de dados',
    dataTitle: ['O seu código continua a ser ', 'seu.'],
    dataLede: 'O fornecedor de inferência opera com zero retenção de dados. O Faelith mantém o seu próprio registo, cifrado e com acesso controlado, do I/O completo dos modelos e da transcrição completa do chat.',
    zdrBadge: 'ZDR no fornecedor',
    zdrTitle: 'Nenhuma retenção no fornecedor.',
    zdrBody: 'O fornecedor de inferência processa o pedido sem o guardar. Existe uma tabela de preços para todas as chaves; o tratamento de dados nunca altera o preço.',
    captureBadge: 'Captura Faelith cifrada',
    captureTitle: 'I/O completo guardado durante 90 dias.',
    captureBody: 'O Faelith guarda o input e o output exatos do modelo e a transcrição completa no seu próprio S3. Inclui mensagens de sistema e de ferramentas, chamadas de ferramentas, leituras e escritas de ficheiros, resultados de grep, novas tentativas, raciocínio e respostas do assistente.',
  },
};

/**
 * Finds the 256k row for a family so the family card can show its base list card.
 */
function baseRate(rows: ModelRateRow[], family: string): ModelRateRow | undefined {
  return rows.find((row) => row.family === family && row.window === '256k');
}

/**
 * Renders the public model catalog and data-handling policy summary.
 */
export function ModelsPage() {
  const t = useT(T);
  const rows = listModelRates();
  const echo = baseRate(rows, 'Echo');
  const horizon = baseRate(rows, 'Horizon');

  return (
    <div className="page">
      <header className={styles.pageHero}>
        <p className="kicker fade-up">{t.kicker}</p>
        <h1 className={`${styles.title} fade-up`} style={{ ['--delay' as string]: '80ms' }}>
          {t.title[0]}<span className="serif">{t.title[1]}</span>{t.title[2]}
        </h1>
        <p className="lede fade-up" style={{ ['--delay' as string]: '160ms' }}>
          {t.lede}
        </p>
      </header>

      <div className={styles.families}>
        <Reveal className={`card ${styles.family}`}>
          <span className={styles.familyTag}>{t.echoTag}</span>
          <h2 className={styles.familyName}>Echo</h2>
          <p className={styles.familyBody}>{t.echoBody}</p>
          <div className={styles.familyRates}>
            <span className={styles.rate}>
              <span className={styles.rateValue}>{echo ? formatUsdRate(echo.inputUsd) : '—'}</span>
              <span className={styles.rateLabel}>{t.inputLabel}</span>
            </span>
            <span className={styles.rate}>
              <span className={styles.rateValue}>{echo ? formatUsdRate(echo.outputUsd) : '—'}</span>
              <span className={styles.rateLabel}>{t.outputLabel}</span>
            </span>
          </div>
        </Reveal>
        <Reveal delay={90} className={`card ${styles.family} ${styles.familyHorizon}`}>
          <span className={styles.familyTag}>{t.horizonTag}</span>
          <h2 className={styles.familyName}>Horizon</h2>
          <p className={styles.familyBody}>{t.horizonBody}</p>
          <div className={styles.familyRates}>
            <span className={styles.rate}>
              <span className={styles.rateValue}>{horizon ? formatUsdRate(horizon.inputUsd) : '—'}</span>
              <span className={styles.rateLabel}>{t.inputLabel}</span>
            </span>
            <span className={styles.rate}>
              <span className={styles.rateValue}>{horizon ? formatUsdRate(horizon.outputUsd) : '—'}</span>
              <span className={styles.rateLabel}>{t.outputLabel}</span>
            </span>
          </div>
        </Reveal>
      </div>

      <Reveal className="section-head">
        <p className="kicker">{t.cardKicker}</p>
        <h2 className="section-title">
          {t.cardTitle[0]}<span className="serif">{t.cardTitle[1]}</span>{t.cardTitle[2]}
        </h2>
        <p className="lede">{t.cardLede}</p>
      </Reveal>
      <Reveal className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.cols[0]}</th>
              <th>{t.cols[1]}</th>
              <th>{t.cols[2]}</th>
              <th className="num">{t.cols[3]}</th>
              <th className="num">{t.cols[4]}</th>
              <th className="num">{t.cols[5]}</th>
              <th className="num">{t.cols[6]}</th>
              <th className="num">{t.cols[7]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="mono">{row.id}</td>
                <td>{row.family}</td>
                <td>
                  <span className="badge">{row.window}</span>
                </td>
                <td className="num">{formatUsdRate(row.cacheReadUsd)}</td>
                <td className="num">{formatUsdRate(row.cacheWrite5mUsd)}</td>
                <td className="num">{formatUsdRate(row.cacheWrite1hUsd)}</td>
                <td className="num">{formatUsdRate(row.inputUsd)}</td>
                <td className="num">{formatUsdRate(row.outputUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>

      <Reveal className="section-head">
        <p className="kicker">{t.dataKicker}</p>
        <h2 className="section-title">
          {t.dataTitle[0]}<span className="serif">{t.dataTitle[1]}</span>
        </h2>
        <p className="lede">{t.dataLede}</p>
      </Reveal>
      <div className={styles.dataHandlingGrid}>
        <Reveal className="card">
          <span className="badge">{t.zdrBadge}</span>
          <h3 style={{ marginTop: 14 }}>{t.zdrTitle}</h3>
          <p>{t.zdrBody}</p>
        </Reveal>
        <Reveal delay={90} className={`card ${styles.captureCard}`}>
          <span className="badge badge-success">
            <Icon name="shield" size={12} />
            {t.captureBadge}
          </span>
          <h3 style={{ marginTop: 14 }}>{t.captureTitle}</h3>
          <p>{t.captureBody}</p>
        </Reveal>
      </div>
    </div>
  );
}
