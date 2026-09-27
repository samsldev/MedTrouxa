/**
 * NFS-e Nacional: DPS e pedido de cancelamento (e101101) em XML canônico.
 * Port 1:1 de faelith-web/src/nfse/dps.rs.
 *
 * - Ordem, nomes e formatos seguem os XSDs oficiais DPS_v1.01 / pedRegEvento_v1.01
 *   (namespace http://www.sped.fazenda.gov.br/nfse); o texto é escapado exatamente como no C14N, então o
 *   infDPS serializado é idêntico byte a byte à sua forma canônica e o digest da assinatura é estável
 * - Id da DPS = "DPS" + município IBGE (7) + tipo de inscrição (1 CPF, 2 CNPJ) + CNPJ/CPF (14) + série (5) + número (15)
 * - Id do evento = "PRE" + chave de acesso (50) + tipo do evento (6) + número do pedido (3)
 * - Tomador nacional precisa de CPF ou CNPJ; estrangeiro é exportação (tribISSQN 3, cPaisResult, comExt)
 */

/** Namespace de todos os documentos da NFS-e Nacional. */
export const NFSE_NS = 'http://www.sped.fazenda.gov.br/nfse';
/** Versão do layout enviada no atributo `versao`. */
export const LAYOUT_VERSION = '1.01';
/** Código BACEN do dólar americano (usado em `comExt/tpMoeda`). */
export const BACEN_USD = '220';

/** Ambiente (`tpAmb`): 1 produção, 2 produção restrita (homologação). */
export type Environment = 'production' | 'homologation';
export const environmentCode = (e: Environment) => (e === 'production' ? '1' : '2');

/** Identificação federal do tomador (`toma`). */
export type BuyerId =
  | { kind: 'cpf'; value: string }
  | { kind: 'cnpj'; value: string }
  /** NIF estrangeiro (VAT, EIN...). */
  | { kind: 'nif'; value: string }
  /** Estrangeiro sem NIF (`cNaoNIF`): 1 dispensado, 2 não exigido. */
  | { kind: 'noNif'; value: '1' | '2' };

/** Endereço no exterior (`endExt`), para tomadores estrangeiros. */
export interface ForeignAddress {
  country: string; postalCode: string; city: string; state: string; street: string; number: string; district: string;
}

/** Tomador do serviço. */
export interface Buyer {
  id: BuyerId;
  name: string;
  email?: string | null;
  /** ISO 3166-1 alfa-2; `BR` indica venda nacional. */
  country: string;
  foreignAddress?: ForeignAddress | null;
}
export const isForeign = (b: Buyer) => b.country !== 'BR';

/** Prestador (`prest`) e regime tributário, vindos da configuração. */
export interface Seller {
  cnpj: string;
  municipalRegistration?: string | null;
  /** Código IBGE do município do prestador (7 dígitos). */
  cityCode: string;
  /** `opSimpNac`: 1 não optante, 2 MEI, 3 ME/EPP. */
  simplesOption: string;
  /** `regApTribSN` para ME/EPP (1, 2 ou 3); omitido nos demais. */
  simplesRegime?: string | null;
  /** `regEspTrib` (0 nenhum). */
  specialRegime: string;
}

/** Classificação do serviço. */
export interface ServiceCode {
  /** Código de tributação nacional (`cTribNac`, 6 dígitos: item + subitem + desdobro da LC 116). */
  national: string;
  /** Código NBS (`cNBS`, 9 dígitos). */
  nbs: string;
}

/** Declaração opcional de IBS/CBS (Reforma Tributária); as alíquotas são calculadas pelo sistema nacional. */
export interface IbsCbs { operationIndicator: string; cst: string; classCode: string }

/** Data/hora com offset fixo (Brasília, -03:00). */
export interface ZonedDateTime { date: Date; offsetMinutes: number }

/** Tudo o que é preciso para renderizar uma DPS. */
export interface Dps {
  environment: Environment;
  appVersion: string;
  series: number;
  number: number;
  issuedAt: ZonedDateTime;
  /** Data de competência (`dCompet`): a data do pagamento, nunca posterior à emissão. Formato YYYY-MM-DD. */
  competence: string;
  seller: Seller;
  buyer: Buyer;
  service: ServiceCode;
  description: string;
  /** Valor do serviço em centavos de BRL (`vServ`). */
  valueBrlCents: number;
  /** Valor original em centavos de USD (`comExt/vServMoeda`, só exportação). */
  valueUsdCents: number;
  ibsCbs?: IbsCbs | null;
}

/** Escapa texto exatamente como o XML canônico (`&`, `<`, `>`, retorno de carro). */
export function escapeText(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0)!;
    if (ch === '&') out += '&amp;';
    else if (ch === '<') out += '&lt;';
    else if (ch === '>') out += '&gt;';
    else if (ch === '\r') out += '&#xD;';
    // Caracteres proibidos pelo XML 1.0 são descartados em vez de quebrar o documento.
    else if (code < 0x20 && ch !== '\n' && ch !== '\t') continue;
    else out += ch;
  }
  return out;
}

/** Mantém só dígitos ASCII. */
export const digits = (raw: string) => raw.replace(/[^0-9]/g, '');

/** Trunca em `max` caracteres (removendo espaços); usa o fallback quando vazio. */
function bounded(raw: string, max: number, fallback: string): string {
  const text = [...raw.trim()].slice(0, max).join('');
  return text.trim() === '' ? fallback : text.trim();
}

/** Formata centavos como `TSDec15V2` (`123.45`, `0`, `10.00`). */
export function money(cents: number): string {
  const c = Math.max(0, Math.trunc(cents));
  return c === 0 ? '0' : `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
}

/** CPF com 11 dígitos, sem dígitos repetidos e com os dois verificadores corretos. */
export function validCpf(raw: string): boolean {
  const d = [...digits(raw)].map(Number);
  if (d.length !== 11 || d.every((x) => x === d[0])) return false;
  const check = (len: number) => {
    const sum = d.slice(0, len).reduce((s, x, i) => s + x * (len + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === d[9] && check(10) === d[10];
}

/** CNPJ com 14 dígitos, sem dígitos repetidos e com os dois verificadores corretos. */
export function validCnpj(raw: string): boolean {
  const d = [...digits(raw)].map(Number);
  if (d.length !== 14 || d.every((x) => x === d[0])) return false;
  const check = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = d.slice(0, len).reduce((s, x, i) => s + x * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === d[12] && check(13) === d[13];
}

/** Acrescenta `<tag>escapado</tag>`. */
const el = (tag: string, value: string) => `<${tag}>${escapeText(value)}</${tag}>`;

const pad = (n: number, len: number) => String(n).padStart(len, '0');

/** `%Y-%m-%dT%H:%M:%S%:z` no offset informado. */
export function formatDateTime(z: ZonedDateTime): string {
  const local = new Date(z.date.getTime() + z.offsetMinutes * 60_000);
  const sign = z.offsetMinutes < 0 ? '-' : '+';
  const off = Math.abs(z.offsetMinutes);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1, 2)}-${pad(local.getUTCDate(), 2)}T` +
    `${pad(local.getUTCHours(), 2)}:${pad(local.getUTCMinutes(), 2)}:${pad(local.getUTCSeconds(), 2)}${sign}${pad(Math.floor(off / 60), 2)}:${pad(off % 60, 2)}`;
}

/** O identificador de 45 caracteres da DPS (`infDPS/@Id`). */
export function dpsId(d: Dps): string {
  return `DPS${d.seller.cityCode}2${digits(d.seller.cnpj).padStart(14, '0')}${pad(d.series, 5)}${pad(d.number, 15)}`;
}

/** `prest`: CNPJ, inscrição municipal, regime tributário. */
function renderSeller(d: Dps): string {
  const s = d.seller;
  let x = '<prest>' + el('CNPJ', digits(s.cnpj));
  const im = s.municipalRegistration?.trim();
  if (im) x += el('IM', im);
  x += '<regTrib>' + el('opSimpNac', s.simplesOption);
  if (s.simplesRegime && s.simplesOption === '3') x += el('regApTribSN', s.simplesRegime);
  x += el('regEspTrib', s.specialRegime);
  return x + '</regTrib></prest>';
}

/** `toma`: identificação, nome, endereço no exterior, e-mail. */
function renderBuyer(d: Dps): string {
  const b = d.buyer;
  let x = '<toma>';
  switch (b.id.kind) {
    case 'cpf': x += el('CPF', digits(b.id.value)); break;
    case 'cnpj': x += el('CNPJ', digits(b.id.value)); break;
    case 'nif': x += el('NIF', bounded(b.id.value, 40, '0')); break;
    case 'noNif': x += el('cNaoNIF', b.id.value); break;
  }
  x += el('xNome', bounded(b.name, 300, 'Consumidor'));
  const addr = b.foreignAddress;
  if (addr && isForeign(b)) {
    x += '<end><endExt>' + el('cPais', addr.country) + el('cEndPost', bounded(addr.postalCode, 11, '0')) +
      el('xCidade', bounded(addr.city, 60, 'Não informado')) + el('xEstProvReg', bounded(addr.state, 60, 'Não informado')) +
      '</endExt>' + el('xLgr', bounded(addr.street, 255, 'Não informado')) + el('nro', bounded(addr.number, 60, 'S/N')) +
      el('xBairro', bounded(addr.district, 60, 'Não informado')) + '</end>';
  }
  if (b.email && b.email.includes('@') && b.email.length <= 80) x += el('email', b.email);
  return x + '</toma>';
}

/** `serv`: local da prestação, códigos, descrição e comércio exterior nas exportações. */
function renderService(d: Dps): string {
  let x = '<serv><locPrest>' + el('cLocPrestacao', d.seller.cityCode) + '</locPrest><cServ>' +
    el('cTribNac', d.service.national) + el('xDescServ', bounded(d.description, 2000, 'Servico')) + el('cNBS', d.service.nbs) + '</cServ>';
  if (isForeign(d.buyer)) {
    x += '<comExt>' + el('mdPrestacao', '1') + el('vincPrest', '0') + el('tpMoeda', BACEN_USD) + el('vServMoeda', money(d.valueUsdCents)) +
      el('mecAFComexP', '01') + el('mecAFComexT', '01') + el('movTempBens', '1') + el('mdic', '0') + '</comExt>';
  }
  return x + '</serv>';
}

/** `valores`: valor do serviço e tratamento do ISSQN (tributável ou exportação). */
function renderValues(d: Dps): string {
  let x = '<valores><vServPrest>' + el('vServ', money(d.valueBrlCents)) + '</vServPrest><trib><tribMun>';
  x += isForeign(d.buyer) ? el('tribISSQN', '3') + el('cPaisResult', d.buyer.country) : el('tribISSQN', '1');
  x += el('tpRetISSQN', '1') + '</tribMun><totTrib>' + el('indTotTrib', '0') + '</totTrib></trib></valores>';
  return x;
}

/** Filhos de `infDPS`, na ordem do XSD. */
function infBody(d: Dps): string {
  let x = el('tpAmb', environmentCode(d.environment)) + el('dhEmi', formatDateTime(d.issuedAt)) +
    el('verAplic', bounded(d.appVersion, 20, 'MedTrouxa')) + el('serie', String(d.series)) + el('nDPS', String(d.number)) +
    el('dCompet', d.competence) + el('tpEmit', '1') + el('cLocEmi', d.seller.cityCode);
  x += renderSeller(d) + renderBuyer(d) + renderService(d) + renderValues(d);
  if (d.ibsCbs) {
    x += '<IBSCBS>' + el('finNFSe', '0') + el('indFinal', d.buyer.id.kind === 'cpf' ? '1' : '0') + el('cIndOp', d.ibsCbs.operationIndicator) +
      el('indDest', '0') + '<valores><trib><gIBSCBS>' + el('CST', d.ibsCbs.cst) + el('cClassTrib', d.ibsCbs.classCode) + '</gIBSCBS></trib></valores></IBSCBS>';
  }
  return x;
}

/** Elemento `infDPS` canônico (com o namespace padrão herdado): a entrada do digest. */
export const dpsCanonicalInf = (d: Dps) => `<infDPS xmlns="${NFSE_NS}" Id="${dpsId(d)}">${infBody(d)}</infDPS>`;

/** Documento; `signature` (um elemento `<Signature>` completo) é anexado após `infDPS`. */
export const dpsDocument = (d: Dps, signature: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="${NFSE_NS}" versao="${LAYOUT_VERSION}"><infDPS Id="${dpsId(d)}">${infBody(d)}</infDPS>${signature}</DPS>`;

/** Pedido de cancelamento (evento e101101) de uma NFS-e emitida. */
export interface CancelRequest {
  environment: Environment;
  appVersion: string;
  requestedAt: ZonedDateTime;
  sellerCnpj: string;
  accessKey: string;
  /** `cMotivo`: 1 erro na emissão, 2 serviço não prestado, 9 outros. */
  reasonCode: '1' | '2' | '9';
  /** `xMotivo`, de 15 a 255 caracteres. */
  reason: string;
}

/** O identificador de 62 caracteres do pedido (`infPedReg/@Id`). */
export const cancelId = (c: CancelRequest) => `PRE${c.accessKey}101101001`;

function cancelBody(c: CancelRequest): string {
  let reason = bounded(c.reason, 255, 'Cancelamento solicitado pelo prestador');
  while ([...reason].length < 15) reason += '.';
  return el('tpAmb', environmentCode(c.environment)) + el('verAplic', bounded(c.appVersion, 20, 'MedTrouxa')) +
    el('dhEvento', formatDateTime(c.requestedAt)) + el('CNPJAutor', digits(c.sellerCnpj)) + el('chNFSe', c.accessKey) +
    el('nPedRegEvento', '1') + '<e101101>' + el('xDesc', 'Cancelamento de NFS-e') + el('cMotivo', c.reasonCode) + el('xMotivo', reason) + '</e101101>';
}

/** Elemento `infPedReg` canônico: a entrada do digest. */
export const cancelCanonicalInf = (c: CancelRequest) => `<infPedReg xmlns="${NFSE_NS}" Id="${cancelId(c)}">${cancelBody(c)}</infPedReg>`;

/** Documento com a assinatura anexada após `infPedReg`. */
export const cancelDocument = (c: CancelRequest, signature: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><pedRegEvento xmlns="${NFSE_NS}" versao="${LAYOUT_VERSION}"><infPedReg Id="${cancelId(c)}">${cancelBody(c)}</infPedReg>${signature}</pedRegEvento>`;
