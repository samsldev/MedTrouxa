/**
 * Cliente dos endpoints da NFS-e Nacional. Port 1:1 de faelith-web/src/nfse/client.rs.
 *
 * - Emissão: POST {sefin}/nfse com {"dpsXmlGZipB64"}; eventos: POST {sefin}/nfse/{chave}/eventos com
 *   {"pedidoRegistroEventoXmlGZipB64"}; recuperação: GET {sefin}/dps/{id}; PDF: GET {adn}/danfse/{chave}
 * - Documentos trafegam como XML UTF-8, compactados em gzip e codificados em Base64; respostas em JSON
 * - O cliente TLS apresenta o certificado A1 da empresa; raízes extras (ICP-Brasil) podem ser adicionadas
 * - Uma interface mantém o serviço testável sem os endpoints do governo
 */
import { Agent, request } from 'https';
import { rootCertificates } from 'tls';
import { gunzipSync, gzipSync } from 'zlib';
import type { Environment } from './dps';

/** Resultado do envio de uma DPS. */
export type Submission =
  /** NFS-e autorizada: chave de acesso e o XML da NFS-e devolvido pelo sistema. */
  | { kind: 'issued'; accessKey: string; nfseXml: string }
  /** Rejeição por regra de negócio (não reenviar o mesmo conteúdo); corpo do erro guardado para o admin. */
  | { kind: 'rejected'; error: string }
  /** Falha de transporte ou do servidor: resultado desconhecido, tentar de novo após consultar o id da DPS. */
  | { kind: 'unavailable'; error: string };

/** Operações do sistema nacional usadas pelo MedTrouxa. */
export interface NfseGateway {
  /** Envia uma DPS assinada. */
  submitDps(signedXml: string): Promise<Submission>;
  /** Chave de acesso da NFS-e gerada a partir de um id de DPS, quando existir (recuperação idempotente). */
  findByDps(dpsId: string): Promise<string | null>;
  /** XML da NFS-e pela chave de acesso. */
  fetchNfse(accessKey: string): Promise<string>;
  /** Envia um pedido de evento assinado (cancelamento); resolve quando registrado. */
  submitEvent(accessKey: string, signedXml: string): Promise<void>;
  /** PDF do DANFSe pela chave de acesso. */
  danfse(accessKey: string): Promise<Buffer>;
}

/** Gzip e depois Base64: a codificação de transporte de todo documento. */
export const pack = (xml: string) => gzipSync(Buffer.from(xml, 'utf8')).toString('base64');
/** Base64 e depois gunzip. */
export const unpack = (b64: string) => gunzipSync(Buffer.from(b64.trim(), 'base64')).toString('utf8');

/** Primeiro campo parecido com chave de acesso de uma resposta JSON. */
function accessKey(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  for (const f of ['chaveAcesso', 'ChaveAcesso', 'chNFSe']) if (typeof o[f] === 'string') return o[f] as string;
  return null;
}

const clip = (s: string, n: number) => [...s].slice(0, n).join('');

interface HttpResponse { status: number; body: Buffer }

/** Cliente real dos endpoints nacionais, com mTLS. */
export class LiveGateway implements NfseGateway {
  private agent: Agent;
  private sefin: string;
  private adn: string;

  /** `keyPem` + `certPem`: identidade TLS da empresa; `extraRootsPem`: raízes ICP-Brasil adicionais. */
  constructor(environment: Environment, keyPem: string, certPem: string, extraRootsPem?: string | null) {
    this.agent = new Agent({
      key: keyPem,
      cert: certPem,
      ca: extraRootsPem ? [...rootCertificates, extraRootsPem] : undefined,
      keepAlive: true,
      maxSockets: 8,
    });
    [this.sefin, this.adn] = environment === 'production'
      ? ['https://sefin.nfse.gov.br/sefinnacional', 'https://adn.nfse.gov.br']
      : ['https://sefin.producaorestrita.nfse.gov.br/SefinNacional', 'https://adn.producaorestrita.nfse.gov.br'];
  }

  private http(method: 'GET' | 'POST', url: string, json?: unknown): Promise<HttpResponse> {
    const payload = json === undefined ? undefined : Buffer.from(JSON.stringify(json), 'utf8');
    return new Promise((resolve, reject) => {
      const req = request(url, {
        method, agent: this.agent, timeout: 60_000,
        headers: { accept: 'application/json', ...(payload ? { 'content-type': 'application/json', 'content-length': payload.length } : {}) },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      });
      req.setTimeout(60_000, () => req.destroy(new Error('timeout')));
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  async submitDps(signedXml: string): Promise<Submission> {
    let packed: string;
    try { packed = pack(signedXml); } catch (e) { return { kind: 'rejected', error: String(e) }; }
    let res: HttpResponse;
    try { res = await this.http('POST', `${this.sefin}/nfse`, { dpsXmlGZipB64: packed }); }
    catch (e) { return { kind: 'unavailable', error: e instanceof Error ? e.message : String(e) }; }
    const text = res.body.toString('utf8');
    if (res.status >= 500 || res.status === 429) return { kind: 'unavailable', error: `${res.status}: ${clip(text, 2000)}` };
    let body: Record<string, unknown> | null = null;
    try { body = JSON.parse(text); } catch { /* corpo não-JSON */ }
    const key = accessKey(body);
    const xml = body && typeof body.nfseXmlGZipB64 === 'string' ? body.nfseXmlGZipB64 : null;
    if (res.status >= 200 && res.status < 300 && key && xml) {
      try { return { kind: 'issued', accessKey: key, nfseXml: unpack(xml) }; }
      catch (e) { return { kind: 'unavailable', error: `NFS-e não decodificável: ${e}` }; }
    }
    return { kind: 'rejected', error: `${res.status}: ${clip(text, 4000)}` };
  }

  async findByDps(dpsId: string): Promise<string | null> {
    const res = await this.http('GET', `${this.sefin}/dps/${encodeURIComponent(dpsId)}`);
    if (res.status === 404) return null;
    if (res.status < 200 || res.status >= 300) throw new Error(`consulta da DPS falhou com ${res.status}`);
    return accessKey(JSON.parse(res.body.toString('utf8')));
  }

  async fetchNfse(key: string): Promise<string> {
    const res = await this.http('GET', `${this.sefin}/nfse/${encodeURIComponent(key)}`);
    if (res.status < 200 || res.status >= 300) throw new Error(`consulta da NFS-e falhou com ${res.status}`);
    const body = JSON.parse(res.body.toString('utf8'));
    if (typeof body.nfseXmlGZipB64 !== 'string') throw new Error('consulta da NFS-e sem XML');
    return unpack(body.nfseXmlGZipB64);
  }

  async submitEvent(key: string, signedXml: string): Promise<void> {
    const res = await this.http('POST', `${this.sefin}/nfse/${encodeURIComponent(key)}/eventos`, { pedidoRegistroEventoXmlGZipB64: pack(signedXml) });
    if (res.status < 200 || res.status >= 300) throw new Error(`${res.status}: ${clip(res.body.toString('utf8'), 4000)}`);
  }

  async danfse(key: string): Promise<Buffer> {
    const res = await this.http('GET', `${this.adn}/danfse/${encodeURIComponent(key)}`);
    if (res.status < 200 || res.status >= 300) throw new Error(`danfse falhou com ${res.status}`);
    return res.body;
  }
}

/** Lê `<nNFSe>` de um XML de NFS-e (o número atribuído pelo sistema nacional). */
export function nfseNumber(nfseXml: string): string | null {
  const start = nfseXml.indexOf('<nNFSe>');
  if (start < 0) return null;
  const from = start + '<nNFSe>'.length;
  const end = nfseXml.indexOf('</nNFSe>', from);
  return end < 0 ? null : nfseXml.slice(from, end);
}
