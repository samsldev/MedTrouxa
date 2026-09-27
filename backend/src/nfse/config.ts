/**
 * Configuração do emissor a partir do ambiente (variáveis NFSE_*). Port 1:1 de faelith-web/src/nfse/config.rs.
 *
 * - Desligado a menos que NFSE_ENABLED=1; quando ligado, todo valor obrigatório é validado no boot (fail fast)
 * - Padrões: homologação, série 1, cTribNac 010301 (LC 116 item 1.03.01, processamento de dados),
 *   Simples Nacional ME/EPP (opSimpNac 3, regApTribSN 1), sem regime especial, grupo IBS/CBS desligado
 * - cTribNac, NBS, regime e alíquotas devem ser confirmados pelo contador
 * - O certificado é lido de arquivos PEM convertidos uma vez a partir do .pfx A1
 */
import { readFileSync } from 'fs';
import { digits, Environment, IbsCbs, Seller, ServiceCode, validCnpj } from './dps';

/** Configuração validada do emissor. */
export interface NfseConfig {
  environment: Environment;
  seller: Seller;
  series: number;
  service: ServiceCode;
  /** Primeira parte de `xDescServ` (as linhas da cobrança são anexadas). */
  descriptionPrefix: string;
  appVersion: string;
  ibsCbs: IbsCbs | null;
  /** Certificado folha (e cadeia opcional) em PEM. */
  certPem: string;
  /** Chave privada RSA em PEM (PKCS#8 ou PKCS#1). */
  keyPem: string;
  /** Raízes extras confiáveis para os endpoints do governo (ICP-Brasil), em PEM. */
  caBundlePem: string | null;
}

/** Lê uma variável, sem espaços; vazia conta como ausente. */
const v = (name: string) => { const x = process.env[name]?.trim(); return x ? x : null; };
const required = (name: string) => { const x = v(name); if (!x) throw new Error(`${name} é obrigatório quando NFSE_ENABLED=1`); return x; };
function fixedDigits(name: string, value: string, len: number) {
  if (value.length === len && /^\d+$/.test(value)) return value;
  throw new Error(`${name} deve ter exatamente ${len} dígitos`);
}
function readFile(name: string, path: string) {
  try { return readFileSync(path, 'utf8'); } catch (e) { throw new Error(`${name} (${path}): ${e instanceof Error ? e.message : e}`); }
}

/** null quando o emissor está desligado; lança erro quando ligado mas mal configurado. */
export function nfseConfigFromEnv(): NfseConfig | null {
  if (!['1', 'true'].includes(v('NFSE_ENABLED') ?? '')) return null;
  const cnpj = digits(required('NFSE_CNPJ'));
  if (!validCnpj(cnpj)) throw new Error('NFSE_CNPJ não é um CNPJ válido');
  const env = v('NFSE_ENV');
  let environment: Environment;
  if (env === 'producao' || env === 'production') environment = 'production';
  else if (env === null || env === 'homologacao' || env === 'homologation') environment = 'homologation';
  else throw new Error(`NFSE_ENV deve ser homologacao ou producao, recebido ${env}`);
  const simplesOption = v('NFSE_SIMPLES_OPTION') ?? '3';
  if (!['1', '2', '3'].includes(simplesOption)) throw new Error('NFSE_SIMPLES_OPTION deve ser 1, 2 ou 3');
  const op = v('NFSE_IBSCBS_CINDOP'), cst = v('NFSE_IBSCBS_CST'), cls = v('NFSE_IBSCBS_CCLASSTRIB');
  let ibsCbs: IbsCbs | null = null;
  if (op && cst && cls) {
    ibsCbs = { operationIndicator: fixedDigits('NFSE_IBSCBS_CINDOP', op, 6), cst: fixedDigits('NFSE_IBSCBS_CST', cst, 3), classCode: fixedDigits('NFSE_IBSCBS_CCLASSTRIB', cls, 6) };
  } else if (op || cst || cls) {
    throw new Error('defina todas NFSE_IBSCBS_CINDOP, NFSE_IBSCBS_CST e NFSE_IBSCBS_CCLASSTRIB, ou nenhuma');
  }
  const series = Number(v('NFSE_SERIES') ?? '1');
  if (!Number.isInteger(series)) throw new Error('NFSE_SERIES deve ser um número');
  if (series < 1 || series > 99_999) throw new Error('NFSE_SERIES deve estar entre 1 e 99999');
  const certPath = required('NFSE_CERT_PEM_PATH');
  const keyPath = required('NFSE_KEY_PEM_PATH');
  const caPath = v('NFSE_CA_BUNDLE_PATH');
  return {
    environment,
    seller: {
      cnpj,
      municipalRegistration: v('NFSE_IM'),
      cityCode: fixedDigits('NFSE_CITY_CODE', required('NFSE_CITY_CODE'), 7),
      simplesRegime: simplesOption === '3' ? (v('NFSE_SIMPLES_REGIME') ?? '1') : null,
      simplesOption,
      specialRegime: v('NFSE_SPECIAL_REGIME') ?? '0',
    },
    series,
    service: {
      national: fixedDigits('NFSE_TRIB_NAC', v('NFSE_TRIB_NAC') ?? '010301', 6),
      nbs: fixedDigits('NFSE_NBS', required('NFSE_NBS'), 9),
    },
    descriptionPrefix: v('NFSE_DESCRIPTION') ?? 'Serviço de acesso à plataforma de estudos MedTrouxa (questões, flashcards, simulados e IA), SaaS',
    appVersion: 'MedTrouxa_1.0',
    ibsCbs,
    certPem: readFile('NFSE_CERT_PEM_PATH', certPath),
    keyPem: readFile('NFSE_KEY_PEM_PATH', keyPath),
    caBundlePem: caPath ? readFile('NFSE_CA_BUNDLE_PATH', caPath) : null,
  };
}
