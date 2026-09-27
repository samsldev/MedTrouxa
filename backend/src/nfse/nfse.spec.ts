import { createVerify, generateKeyPairSync, X509Certificate } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { nfseNumber, pack, unpack } from './client';
import {
  Buyer, cancelDocument, cancelId, digits, Dps, dpsCanonicalInf, dpsDocument, dpsId, money, validCnpj, validCpf,
} from './dps';
import { rateForPayment, usdToBrlCents } from './ptax';
import { signedInfo, SigningIdentity } from './sign';

const BRT = -180;

/** Fixture de DPS nacional (mesmos valores do dps.rs). */
export function fixture(buyer: Buyer): Dps {
  return {
    environment: 'homologation', appVersion: 'Faelith_1.0', series: 1, number: 3180,
    issuedAt: { date: new Date('2026-09-26T13:00:00Z'), offsetMinutes: BRT }, competence: '2026-09-25',
    seller: { cnpj: '11.222.333/0001-81', municipalRegistration: null, cityCode: '3170206', simplesOption: '3', simplesRegime: '1', specialRegime: '0' },
    buyer, service: { national: '010301', nbs: '123456789' },
    description: 'Assinatura Faelith Pro <mensal> & uso', valueBrlCents: 10_950, valueUsdCents: 2_000, ibsCbs: null,
  };
}
const ana: Buyer = { id: { kind: 'cpf', value: '123.456.789-09' }, name: 'Ana', email: 'ana@example.com', country: 'BR', foreignAddress: null };

describe('dps (port de dps.rs)', () => {
  it('Id tem 45 caracteres com CNPJ tipo 2, série e número com zeros', () => {
    const id = dpsId(fixture({ ...ana, email: null }));
    expect(id).toBe('DPS317020621122233300018100001000000000003180');
    expect(id).toHaveLength(45);
  });

  it('venda nacional: CPF, ISS tributável, descrição escapada, sem comExt', () => {
    const d = fixture(ana);
    const doc = dpsDocument(d, '');
    expect(doc).toContain('<toma><CPF>12345678909</CPF><xNome>Ana</xNome><email>ana@example.com</email></toma>');
    expect(doc).toContain('<tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN>');
    expect(doc).toContain('Assinatura Faelith Pro &lt;mensal&gt; &amp; uso');
    expect(doc).toContain('<vServ>109.50</vServ>');
    expect(doc).toContain('<regTrib><opSimpNac>3</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib>');
    expect(doc).not.toContain('comExt');
    expect(dpsCanonicalInf(d).startsWith('<infDPS xmlns="http://www.sped.fazenda.gov.br/nfse" Id="DPS')).toBe(true);
  });

  it('exportação: estrangeiro sem NIF, ISS de exportação, país de resultado, comExt em USD', () => {
    const doc = dpsDocument(fixture({
      id: { kind: 'noNif', value: '2' }, name: 'John Doe', email: null, country: 'US',
      foreignAddress: { country: 'US', postalCode: '94105', city: 'San Francisco', state: 'CA', street: 'Market St', number: '', district: '' },
    }), '');
    expect(doc).toContain('<cNaoNIF>2</cNaoNIF><xNome>John Doe</xNome><end><endExt><cPais>US</cPais>');
    expect(doc).toContain('<nro>S/N</nro><xBairro>Não informado</xBairro>');
    expect(doc).toContain('<tribISSQN>3</tribISSQN><cPaisResult>US</cPaisResult>');
    expect(doc).toContain('<tpMoeda>220</tpMoeda><vServMoeda>20.00</vServMoeda>');
  });

  it('cancelamento: Id com 62 caracteres e motivo completado até 15 caracteres', () => {
    const req = {
      environment: 'homologation' as const, appVersion: 'Faelith_1.0', requestedAt: { date: new Date('2026-09-26T13:00:00Z'), offsetMinutes: BRT },
      sellerCnpj: '11222333000181', accessKey: '3'.repeat(50), reasonCode: '2' as const, reason: 'Reembolso',
    };
    expect(cancelId(req)).toHaveLength(62);
    expect(cancelDocument(req, '')).toContain('<nPedRegEvento>1</nPedRegEvento><e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>2</cMotivo><xMotivo>Reembolso......</xMotivo>');
  });

  it('dígitos verificadores de CPF e CNPJ; formato de valores', () => {
    expect(validCpf('123.456.789-09')).toBe(true);
    expect(validCpf('123.456.789-00')).toBe(false);
    expect(validCpf('111.111.111-11')).toBe(false);
    expect(validCnpj('11.222.333/0001-81')).toBe(true);
    expect(validCnpj('11.222.333/0001-80')).toBe(false);
    expect([money(0), money(5), money(1_000)]).toEqual(['0', '0.05', '10.00']);
  });
});

describe('conformidade com o emissor em Rust (dps_starter.xml gerado pelo faelith-web)', () => {
  const original = readFileSync(join(__dirname, '__fixtures__', 'dps_starter.xml'), 'utf8');
  const dps: Dps = {
    environment: 'homologation', appVersion: 'Faelith_1.0', series: 1, number: 1,
    issuedAt: { date: new Date('2026-09-27T02:37:46Z'), offsetMinutes: BRT }, competence: '2026-09-26',
    seller: { cnpj: '11222333000181', municipalRegistration: null, cityCode: '3170206', simplesOption: '3', simplesRegime: '1', specialRegime: '0' },
    buyer: { id: { kind: 'cpf', value: '12345678909' }, name: 'Maria Oliveira (exemplo)', email: 'maria@example.com', country: 'BR' },
    service: { national: '010301', nbs: '123456789' },
    description: 'Serviço de processamento de dados por inteligência artificial (plataforma Faelith, SaaS) - 1 × Faelith Starter (mensal) - US$ 20,00 - Fatura in_1SAMPLEstarter - Valor cobrado USD 20.00, convertido pela PTAX de venda de 25/09/2026 (R$ 5.1991)',
    valueBrlCents: 10_398, valueUsdCents: 2_000, ibsCbs: null,
  };
  const signature = original.slice(original.indexOf('<Signature'), original.indexOf('</DPS>'));

  it('documento gerado é idêntico byte a byte ao do Rust (com a mesma assinatura)', () => {
    expect(dpsDocument(dps, signature)).toBe(original);
  });

  it('DigestValue do infDPS canônico bate com o do Rust', () => {
    const digest = /<DigestValue>([^<]+)<\/DigestValue>/.exec(original)![1];
    expect(require('crypto').createHash('sha1').update(dpsCanonicalInf(dps), 'utf8').digest('base64')).toBe(digest);
    expect(digest).toBe('ROeSnvHqoUJzsO6FoklQQ+OtTbc=');
  });

  it('a assinatura RSA-SHA1 original valida sobre o SignedInfo montado pelo port', () => {
    const digest = /<DigestValue>([^<]+)<\/DigestValue>/.exec(original)![1];
    const value = /<SignatureValue>([^<]+)<\/SignatureValue>/.exec(original)![1];
    const der = /<X509Certificate>([^<]+)<\/X509Certificate>/.exec(original)![1];
    const cert = new X509Certificate(Buffer.from(der, 'base64'));
    const ok = createVerify('RSA-SHA1').update(signedInfo(dpsId(dps), digest), 'utf8').verify(cert.publicKey, Buffer.from(value, 'base64'));
    expect(ok).toBe(true);
  });
});

describe('assinatura (port de sign.rs)', () => {
  it('digest cobre o elemento canônico e a assinatura verifica sobre o SignedInfo', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
    const identity = SigningIdentity.fromParts(privateKey, Buffer.from([1, 2, 3]));
    const canonical = '<infDPS xmlns="http://www.sped.fazenda.gov.br/nfse" Id="DPS1"><tpAmb>2</tpAmb></infDPS>';
    const element = identity.signatureFor('DPS1', canonical);
    const digest = require('crypto').createHash('sha1').update(canonical).digest('base64');
    expect(element).toContain(`<DigestValue>${digest}</DigestValue>`);
    expect(element).toContain('<Reference URI="#DPS1">');
    expect(element).toContain('<X509Certificate>AQID</X509Certificate>');
    const value = element.split('<SignatureValue>')[1].split('</SignatureValue>')[0];
    expect(createVerify('RSA-SHA1').update(signedInfo('DPS1', digest)).verify(publicKey, Buffer.from(value, 'base64'))).toBe(true);
  });
});

describe('transporte e PTAX (port de client.rs e ptax.rs)', () => {
  it('pack/unpack e número da NFS-e', () => {
    const xml = '<NFSe><infNFSe><nNFSe>42</nNFSe></infNFSe></NFSe>';
    expect(unpack(pack(xml))).toBe(xml);
    expect(nfseNumber(xml)).toBe('42');
  });
  it('pagamento na segunda usa a cotação de sexta; conversão arredonda em centavos', async () => {
    const weekdays = { ptaxSell: async (day: string) => ([1, 2, 3, 4, 5].includes(new Date(`${day}T00:00:00Z`).getUTCDay()) ? 5.2 : null) };
    const r = await rateForPayment(weekdays, '2026-09-28');
    expect(r.day).toBe('2026-09-25');
    expect(usdToBrlCents(2_000, r.rate)).toBe(10_400);
    expect(digits('12.345-6')).toBe('123456');
  });
});

// ---------------- service.rs ----------------
import { NfseGateway, Submission } from './client';
import { NfseConfig } from './config';
import { documentFromCharge, identityFromPayer, NfseService, onReversal, PaidCharge, saveIdentity } from './service';
import { MemoryNfse, status } from './store';

/** Gateway roteirizado que registra o que recebeu. */
class FakeGateway implements NfseGateway {
  outcomes: Submission[] = [];
  submitted: string[] = [];
  events: string[] = [];
  knownDps: string | null = null;
  async submitDps(xml: string) { this.submitted.push(xml); return this.outcomes.shift()!; }
  async findByDps() { return this.knownDps; }
  async fetchNfse() { return '<NFSe><nNFSe>77</nNFSe></NFSe>'; }
  async submitEvent(_k: string, xml: string) { this.events.push(xml); }
  async danfse() { return Buffer.from('%PDF'); }
}

function service(gateway: FakeGateway, rate = 5.0) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
  const config: NfseConfig = {
    environment: 'homologation',
    seller: { cnpj: '11222333000181', municipalRegistration: null, cityCode: '3170206', simplesOption: '3', simplesRegime: '1', specialRegime: '0' },
    series: 1, service: { national: '010301', nbs: '123456789' }, descriptionPrefix: 'Serviço', appVersion: 'MedTrouxa_1.0',
    ibsCbs: null, certPem: '', keyPem: '', caBundlePem: null,
  };
  return new NfseService(config, SigningIdentity.fromParts(privateKey, Buffer.from([1])), gateway, { ptaxSell: async () => rate });
}

const charge = (id: string, extra: Partial<PaidCharge> = {}): PaidCharge => ({
  sourceId: id, paymentId: `pay_${id}`, userId: '00000000-0000-4000-8000-000000000009', amountCents: 79_990, currency: 'brl',
  paidAt: new Date(1_790_000_000_000), buyerName: 'Ana', buyerEmail: 'ana@example.com', lines: ['Plano Alquimista (1 ano de acesso)'], ...extra,
});

describe('service (port de service.rs)', () => {
  it('tomador nacional sem CPF aguarda dados; emite depois que o CPF é salvo; reentrega do webhook é ignorada', async () => {
    const store = new MemoryNfse();
    const gw = new FakeGateway();
    gw.outcomes.push({ kind: 'issued', accessKey: '1'.repeat(50), nfseXml: '<NFSe><nNFSe>5</nNFSe></NFSe>' });
    const svc = service(gw);
    const doc = documentFromCharge(charge('sub_1'), 1)!;
    expect(await store.enqueue(doc)).toBe(true);
    expect(await store.enqueue(documentFromCharge(charge('sub_1'), 1)!)).toBe(false);

    let claimed = await store.claimDue(new Date(), 10);
    expect(await svc.process(store, claimed[0])).toEqual({ kind: 'needsTaxId', email: 'ana@example.com' });
    expect((await store.get(doc.id))!.status).toBe(status.PENDING_DATA);

    expect(await saveIdentity(store, { customerId: doc.customerId!, userId: doc.userId, docType: 'cpf', docNumber: '12345678909', updatedAt: new Date() })).toBe(1);
    claimed = await store.claimDue(new Date(), 10);
    expect(await svc.process(store, claimed[0])).toEqual({ kind: 'issued', email: 'ana@example.com', number: '5', docId: doc.id });
    const issued = (await store.get(doc.id))!;
    expect([issued.status, issued.number, issued.amountBrlCents]).toEqual([status.ISSUED, 1, 79_990]);
    expect(gw.submitted[0]).toContain('<CPF>12345678909</CPF>');
    expect(gw.submitted[0]).toContain('<vServ>799.90</vServ>');
    expect(gw.submitted[0]).toContain('<Signature xmlns=');
  });

  it('CPF do pagador no Mercado Pago emite direto; cobrança em USD usa a PTAX', async () => {
    const store = new MemoryNfse();
    const gw = new FakeGateway();
    gw.outcomes.push({ kind: 'issued', accessKey: '4'.repeat(50), nfseXml: '<NFSe><nNFSe>8</nNFSe></NFSe>' });
    const svc = service(gw, 5.0);
    const doc = documentFromCharge(charge('sub_usd', { currency: 'usd', amountCents: 2_000, payerIdentification: { type: 'CPF', number: '123.456.789-09' } }), 1)!;
    await store.enqueue(doc);
    await svc.process(store, (await store.claimDue(new Date(), 10))[0]);
    const issued = (await store.get(doc.id))!;
    expect([issued.status, issued.amountBrlCents, issued.ptaxRate]).toEqual([status.ISSUED, 10_000, 5]);
    expect(gw.submitted[0]).toContain('convertido pela PTAX de venda');
  });

  it('estrangeiro é exportação; resultado desconhecido é recuperado pelo id da DPS sem reenviar', async () => {
    const store = new MemoryNfse();
    const gw = new FakeGateway();
    gw.outcomes.push({ kind: 'unavailable', error: 'timeout' });
    const svc = service(gw);
    const doc = documentFromCharge(charge('sub_2'), 1)!;
    doc.buyer = { ...doc.buyer, address: { country: 'PT', city: 'Lisboa', postal_code: '1000-001', line1: 'Rua A', state: 'Lisboa' }, tax_ids: [{ type: 'eu_vat', value: 'PT123456789' }] };
    await store.enqueue(doc);
    await svc.process(store, (await store.claimDue(new Date(), 10))[0]);
    const queued = (await store.get(doc.id))!;
    expect([queued.status, queued.attempts]).toEqual([status.QUEUED, 1]);
    expect(gw.submitted[0]).toContain('<NIF>PT123456789</NIF>');
    expect(gw.submitted[0]).toContain('<tribISSQN>3</tribISSQN><cPaisResult>PT</cPaisResult>');

    gw.knownDps = '2'.repeat(50);
    await store.save({ ...queued, nextAttemptAt: new Date() });
    await svc.process(store, (await store.claimDue(new Date(), 10))[0]);
    const issued = (await store.get(doc.id))!;
    expect([issued.status, issued.nfseNumber, issued.number]).toEqual([status.ISSUED, '77', 1]);
    expect(gw.submitted).toHaveLength(1); // recuperada, não reenviada
  });

  it('estorno integral cancela a nota emitida com evento e101101 assinado; não emitidas são anuladas', async () => {
    const store = new MemoryNfse();
    const gw = new FakeGateway();
    gw.outcomes.push({ kind: 'issued', accessKey: '3'.repeat(50), nfseXml: '<NFSe><nNFSe>9</nNFSe></NFSe>' });
    const svc = service(gw);
    const doc = documentFromCharge(charge('sub_3', { payerIdentification: { type: 'CNPJ', number: '11.222.333/0001-81' } }), 1)!;
    await store.enqueue(doc);
    await svc.process(store, (await store.claimDue(new Date(), 10))[0]);

    await onReversal(store, 'pay_sub_3', true, 'Reembolso integral no prazo de arrependimento');
    await svc.process(store, (await store.claimDue(new Date(), 10))[0]);
    expect((await store.get(doc.id))!.status).toBe(status.CANCELED);
    expect(gw.events[0]).toContain('<e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>9</cMotivo>');

    const other = documentFromCharge(charge('sub_4'), 1)!;
    await store.enqueue(other);
    await onReversal(store, 'pay_sub_4', true, 'Contestação de pagamento');
    expect((await store.get(other.id))!.status).toBe(status.VOIDED);
  });

  it('CPF do pagador vira identidade fiscal; CPF inválido é ignorado; sem cobrança não gera documento', () => {
    expect(identityFromPayer('u1', { type: 'CPF', number: '123.456.789-09' })!.docNumber).toBe('12345678909');
    expect(identityFromPayer('u1', { type: 'CPF', number: '111.111.111-11' })).toBeNull();
    expect(documentFromCharge(charge('sub_0', { amountCents: 0 }), 1)).toBeNull();
  });
});
