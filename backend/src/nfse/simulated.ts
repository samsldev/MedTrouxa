/**
 * Modo de SIMULAÇÃO do emissor (NFSE_ENABLED=simulate), só para desenvolvimento e testes de ponta a ponta sem
 * certificado A1 nem acesso ao sistema nacional. Proibido em produção (o boot recusa).
 *
 * A DPS continua sendo montada e assinada exatamente como na emissão real (com uma chave RSA efêmera);
 * apenas o "sistema nacional" é simulado: devolve chave de acesso, um XML de NFS-e e um DANFSe em PDF simples.
 */
import { generateKeyPairSync, randomInt } from 'crypto';
import { NfseGateway, Submission } from './client';
import { NfseConfig } from './config';
import { SigningIdentity } from './sign';

export const simulatedIdentity = () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return SigningIdentity.fromParts(privateKey, Buffer.from('SIMULACAO'), 'SIMULAÇÃO: chave efêmera, sem certificado A1 e sem valor fiscal');
};

export function simulatedConfig(): NfseConfig {
  return {
    environment: 'homologation',
    seller: { cnpj: '11222333000181', municipalRegistration: null, cityCode: '3550308', simplesOption: '3', simplesRegime: '1', specialRegime: '0' },
    series: 1,
    service: { national: '010301', nbs: '115013000' },
    descriptionPrefix: 'Serviço de acesso à plataforma de estudos MedTrouxa (questões, flashcards, simulados e IA), SaaS',
    appVersion: 'MedTrouxa_1.0',
    ibsCbs: null, certPem: '', keyPem: '', caBundlePem: null,
  };
}

const tag = (xml: string, name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1] ?? '';

/** PDF mínimo (uma página, Helvetica) com as linhas informadas. */
function simplePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');
  const content = ['BT', '/F1 11 Tf', '50 790 Td', '14 TL', ...lines.map((l, i) => `${i === 0 ? '/F1 15 Tf ' : i === 1 ? '/F1 10 Tf ' : ''}(${esc(l)}) Tj T*`), 'ET'].join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** "Sistema nacional" simulado: autoriza toda DPS e gera NFS-e / DANFSe fictícios marcados como SIMULAÇÃO. */
export class SimulatedGateway implements NfseGateway {
  private issued = new Map<string, string>();
  private byDps = new Map<string, string>();

  async submitDps(signedXml: string): Promise<Submission> {
    const dpsId = /infDPS Id="([^"]+)"/.exec(signedXml)?.[1] ?? '';
    const accessKey = `${tag(signedXml, 'cLocEmi')}2${'0'.repeat(10)}${String(randomInt(1e9)).padStart(9, '0')}${String(Date.now()).slice(-8)}`.padEnd(50, '0').slice(0, 50);
    const number = tag(signedXml, 'nDPS');
    const nfseXml = `<?xml version="1.0" encoding="UTF-8"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS${accessKey}"><xLocEmi>SIMULACAO</xLocEmi><nNFSe>${number}</nNFSe><dhProc>${new Date().toISOString()}</dhProc><DPS>${signedXml.replace(/^<\?xml[^>]*>/, '')}</DPS></infNFSe></NFSe>`;
    this.issued.set(accessKey, nfseXml);
    this.byDps.set(dpsId, accessKey);
    return { kind: 'issued', accessKey, nfseXml };
  }
  async findByDps(dpsId: string) { return this.byDps.get(dpsId) ?? null; }
  async fetchNfse(key: string) { const x = this.issued.get(key); if (!x) throw new Error('não encontrada'); return x; }
  async submitEvent() { /* cancelamento aceito */ }
  async danfse(key: string) {
    const xml = this.issued.get(key) ?? '';
    return simplePdf([
      'DANFSe - SIMULACAO (sem valor fiscal)',
      `NFS-e n. ${tag(xml, 'nNFSe')}   Chave: ${key}`,
      `Prestador CNPJ: ${tag(xml, 'CNPJ')}`,
      `Tomador: ${tag(xml, 'xNome')}  ${tag(xml, 'CPF') ? `CPF ${tag(xml, 'CPF')}` : ''}`,
      `Servico: ${tag(xml, 'xDescServ').slice(0, 95)}`,
      `Valor do servico: R$ ${tag(xml, 'vServ')}`,
      `Competencia: ${tag(xml, 'dCompet')}`,
    ]);
  }
}
