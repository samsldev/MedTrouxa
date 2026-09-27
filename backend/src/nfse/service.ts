/**
 * Emissão e cancelamento de NFS-e. Port 1:1 de faelith-web/src/nfse/service.rs.
 *
 * - Pagamento aprovado → um documento na fila por cobrança (idempotente); o CPF / CNPJ do pagador guardado como
 *   identidade fiscal retoma os documentos que esperavam por ele
 * - Emissão: resolve o tomador (nacional precisa de CPF ou CNPJ, estrangeiro é exportação), converte USD pela PTAX uma
 *   vez, atribui o número da DPS uma vez, recupera pelo id da DPS após resultado desconhecido, assina, envia
 * - Estornos integrais e chargebacks cancelam notas emitidas (evento e101101) ou anulam as não emitidas; estornos
 *   parciais ficam marcados para substituição manual
 * - Falhas transitórias com espera exponencial (1 min dobrando, teto de 6 h); rejeições param para revisão
 *
 * Adaptação ao MedTrouxa: a "fatura Stripe" (invoice.paid) é a assinatura paga no Mercado Pago; o CPF/CNPJ vem do
 * pagador (payer.identification) ou do formulário do checkout / "Minha conta".
 */
import { nfseNumber, NfseGateway } from './client';
import { NfseConfig } from './config';
import {
  Buyer, BuyerId, CancelRequest, cancelCanonicalInf, cancelDocument, cancelId, digits, Dps, dpsCanonicalInf, dpsDocument, dpsId,
  money, validCnpj, validCpf, ZonedDateTime,
} from './dps';
import { ExchangeRates, rateForPayment, usdToBrlCents } from './ptax';
import { SigningIdentity } from './sign';
import { FiscalIdentity, newDocument, NfseDocument, NfseStore, status } from './store';

/** Horário de Brasília (sem horário de verão desde 2019). */
export const BRASILIA_OFFSET = -180;
export const brasilia = (date: Date): ZonedDateTime => ({ date, offsetMinutes: BRASILIA_OFFSET });
/** Data (YYYY-MM-DD) em Brasília. */
export const brasiliaDay = (date: Date) => new Date(date.getTime() + BRASILIA_OFFSET * 60_000).toISOString().slice(0, 10);

/** Tentativas de cancelamento antes de o documento ficar para tratamento manual. */
const MAX_CANCEL_ATTEMPTS = 5;

/** O que o worker deve avisar ao comprador depois de processar um documento. */
export type Notice =
  | { kind: 'none' }
  /** A nota foi emitida (e-mail com o número, o PDF e o XML). */
  | { kind: 'issued'; email: string; number: string; docId: string }
  /** O comprador precisa informar CPF ou CNPJ (enviado uma vez por documento). */
  | { kind: 'needsTaxId'; email: string };

/** Campo de texto de um objeto JSON por caminho `/a/b/0/c`. */
export function text(value: unknown, pointer: string): string | null {
  let cur: unknown = value;
  for (const part of pointer.split('/').filter(Boolean)) {
    if (cur === null || typeof cur !== 'object') return null;
    cur = Array.isArray(cur) ? cur[Number(part)] : (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' && cur !== '' ? cur : null;
}

/** Dados de uma cobrança aprovada (equivalente ao invoice.paid do Stripe). */
export interface PaidCharge {
  /** Id da assinatura no MedTrouxa (um documento por assinatura paga). */
  sourceId: string;
  /** Id do pagamento no provedor (para estornos). */
  paymentId: string | null;
  userId: string;
  /** Valor pago em centavos. */
  amountCents: number;
  currency: 'brl' | 'usd';
  paidAt: Date;
  buyerName: string | null;
  buyerEmail: string | null;
  /** Documento do pagador informado no provedor (ex.: Mercado Pago payer.identification). */
  payerIdentification?: { type?: string | null; number?: string | null } | null;
  /** Linhas descritivas (ex.: "Plano Alquimista (1 ano de acesso)"). */
  lines: string[];
}

/** Documento da fila para uma cobrança paga; null quando nada foi cobrado. */
export function documentFromCharge(c: PaidCharge, series: number): NfseDocument | null {
  if (!c.sourceId || c.amountCents <= 0) return null;
  const taxIds: { type: string; value: string }[] = [];
  const idType = c.payerIdentification?.type?.toUpperCase();
  const idNumber = c.payerIdentification?.number ?? '';
  if (idType === 'CPF' && validCpf(idNumber)) taxIds.push({ type: 'br_cpf', value: digits(idNumber) });
  if (idType === 'CNPJ' && validCnpj(idNumber)) taxIds.push({ type: 'br_cnpj', value: digits(idNumber) });
  return newDocument({
    sourceId: c.sourceId,
    paymentId: c.paymentId,
    userId: c.userId,
    customerId: c.userId,
    series,
    paidAt: c.paidAt,
    amountUsdCents: c.currency === 'usd' ? c.amountCents : 0,
    amountBrlCents: c.currency === 'brl' ? c.amountCents : null,
    buyer: { name: c.buyerName, email: c.buyerEmail, address: { country: 'BR' }, tax_ids: taxIds, currency: c.currency },
    description: c.lines.join('; '),
  });
}

/** Identidade fiscal do pagador (CPF/CNPJ informado no provedor de pagamento). */
export function identityFromPayer(userId: string, payer?: { type?: string | null; number?: string | null } | null): FiscalIdentity | null {
  const type = payer?.type?.toUpperCase();
  const number = digits(payer?.number ?? '');
  if (type === 'CNPJ' && validCnpj(number)) return { customerId: userId, userId, docType: 'cnpj', docNumber: number, updatedAt: new Date() };
  if (type === 'CPF' && validCpf(number)) return { customerId: userId, userId, docType: 'cpf', docNumber: number, updatedAt: new Date() };
  return null;
}

/** Resolve o tomador; lança Error(motivo) quando um tomador nacional ainda não tem CPF ou CNPJ válido. */
export function resolveBuyer(doc: NfseDocument, identity: FiscalIdentity | null): Buyer {
  const b = doc.buyer;
  const country = text(b, '/address/country')?.toUpperCase();
  if (!country) throw new Error('país de cobrança ausente');
  const name = text(b, '/name') ?? text(b, '/email') ?? 'Consumidor';
  const email = text(b, '/email');
  const rawIds = Array.isArray((b as Record<string, unknown>).tax_ids) ? ((b as Record<string, unknown>).tax_ids as unknown[]) : [];
  const taxIds = rawIds.map((id) => [text(id, '/type'), text(id, '/value')]).filter((p): p is [string, string] => !!p[0] && !!p[1]);
  const find = (kind: string) => taxIds.find(([t]) => t === kind)?.[1] ?? null;
  let id: BuyerId;
  if (country === 'BR') {
    const cnpj = find('br_cnpj'); const cpf = find('br_cpf');
    if (cnpj && validCnpj(cnpj)) id = { kind: 'cnpj', value: digits(cnpj) };
    else if (cpf && validCpf(cpf)) id = { kind: 'cpf', value: digits(cpf) };
    else if (identity?.docType === 'cnpj' && validCnpj(identity.docNumber)) id = { kind: 'cnpj', value: identity.docNumber };
    else if (identity?.docType === 'cpf' && validCpf(identity.docNumber)) id = { kind: 'cpf', value: identity.docNumber };
    else throw new Error('CPF ou CNPJ obrigatório para tomador no Brasil');
  } else {
    const foreign = taxIds.find(([t]) => !t.startsWith('br_'));
    if (foreign) id = { kind: 'nif', value: foreign[1] };
    else if (identity?.docType === 'nif') id = { kind: 'nif', value: identity.docNumber };
    // Consumidor estrangeiro sem NIF: "2 - Não exigência do NIF" (a confirmar com o contador).
    else id = { kind: 'noNif', value: '2' };
  }
  const foreignAddress = country !== 'BR' ? {
    country, postalCode: text(b, '/address/postal_code') ?? '', city: text(b, '/address/city') ?? '', state: text(b, '/address/state') ?? '',
    street: text(b, '/address/line1') ?? '', number: '', district: text(b, '/address/line2') ?? '',
  } : null;
  return { id, name, email, country, foreignAddress };
}

/** Próxima tentativa: 1 minuto dobrando a cada tentativa, teto de 6 horas. */
export function backoff(attempts: number, now: Date): Date {
  const minutes = Math.min(2 ** Math.max(0, Math.min(attempts, 9)), 360);
  return new Date(now.getTime() + minutes * 60_000);
}

/** Emite e cancela notas; compartilhado pelo worker e pelos endpoints do admin. */
export class NfseService {
  constructor(public config: NfseConfig, private identity: SigningIdentity, private gateway: NfseGateway, private rates: ExchangeRates) {}

  /** Subject e validade do certificado (status do admin). */
  certificate() { return { subject: this.identity.subject, notAfter: this.identity.notAfter }; }

  /** PDF do DANFSe de uma nota emitida. */
  danfse(accessKey: string) { return this.gateway.danfse(accessKey); }

  /** Processa um documento reservado e persiste o resultado. */
  async process(store: NfseStore, doc: NfseDocument): Promise<Notice> {
    const now = new Date();
    let notice: Notice = { kind: 'none' };
    if (doc.status === status.QUEUED) notice = await this.issue(store, doc, now);
    else if (doc.status === status.CANCEL_QUEUED) await this.cancel(doc, now);
    await store.save(doc);
    return notice;
  }

  /** Caminho de emissão; `doc` é atualizado no lugar (o chamador salva). */
  private async issue(store: NfseStore, doc: NfseDocument, now: Date): Promise<Notice> {
    const identity = doc.customerId ? await store.getIdentity(doc.customerId) : null;
    let buyer: Buyer;
    try {
      buyer = resolveBuyer(doc, identity);
    } catch (e) {
      const firstTime = doc.status !== status.PENDING_DATA;
      doc.status = status.PENDING_DATA;
      doc.lastError = e instanceof Error ? e.message : String(e);
      const email = text(doc.buyer, '/email');
      return email && firstTime ? { kind: 'needsTaxId', email } : { kind: 'none' };
    }
    if (doc.amountBrlCents === null) {
      try {
        const { day, rate } = await rateForPayment(this.rates, brasiliaDay(doc.paidAt));
        doc.ptaxRate = rate;
        doc.ptaxDate = day;
        doc.amountBrlCents = usdToBrlCents(doc.amountUsdCents, rate);
      } catch (e) {
        return this.retryLater(doc, `PTAX indisponível: ${e instanceof Error ? e.message : e}`, now);
      }
    }
    if (doc.number === null) {
      doc.number = await store.allocateNumber(doc.series);
      // Persiste o número antes do primeiro envio para que uma queda nunca reutilize nem pule um número.
      await store.save(doc);
    }
    const dps = this.render(doc, buyer, now);
    doc.dpsId = dpsId(dps);
    if (doc.attempts > 0) {
      const key = await this.gateway.findByDps(dpsId(dps)).catch(() => null);
      if (key) return this.recover(doc, key, now);
    }
    const signed = dpsDocument(dps, this.identity.signatureFor(dpsId(dps), dpsCanonicalInf(dps)));
    doc.dpsXml = signed;
    doc.attempts += 1;
    const result = await this.gateway.submitDps(signed);
    switch (result.kind) {
      case 'issued': return this.markIssued(doc, result.accessKey, result.nfseXml, now);
      case 'rejected':
        doc.status = status.REJECTED;
        doc.lastError = result.error;
        return { kind: 'none' };
      case 'unavailable': return this.retryLater(doc, result.error, now);
    }
  }

  /** Monta a DPS de um documento com tomador resolvido. */
  private render(doc: NfseDocument, buyer: Buyer, now: Date): Dps {
    let description = this.config.descriptionPrefix;
    if (doc.description) description += ` - ${doc.description}`;
    description += ` - Pedido ${doc.sourceId}`;
    if (doc.ptaxRate !== null && doc.ptaxDate) {
      const [y, m, d] = doc.ptaxDate.split('-');
      description += ` - Valor cobrado USD ${money(doc.amountUsdCents)}, convertido pela PTAX de venda de ${d}/${m}/${y} (R$ ${doc.ptaxRate.toFixed(4)})`;
    }
    return {
      environment: this.config.environment,
      appVersion: this.config.appVersion,
      series: doc.series > 0 ? doc.series : 1,
      number: doc.number ?? 1,
      issuedAt: brasilia(now),
      competence: brasiliaDay(doc.paidAt),
      seller: this.config.seller,
      buyer,
      service: this.config.service,
      description,
      valueBrlCents: doc.amountBrlCents ?? 0,
      valueUsdCents: doc.amountUsdCents,
      ibsCbs: this.config.ibsCbs,
    };
  }

  /** Uma DPS que já gerou nota (resultado desconhecido antes): busca e guarda. */
  private async recover(doc: NfseDocument, key: string, now: Date): Promise<Notice> {
    try {
      return this.markIssued(doc, key, await this.gateway.fetchNfse(key), now);
    } catch (e) {
      return this.retryLater(doc, `falha ao recuperar: ${e instanceof Error ? e.message : e}`, now);
    }
  }

  /** Guarda uma nota autorizada. */
  private markIssued(doc: NfseDocument, key: string, xml: string, now: Date): Notice {
    doc.status = status.ISSUED;
    doc.nfseNumber = nfseNumber(xml);
    doc.accessKey = key;
    doc.nfseXml = xml;
    doc.issuedAt = now;
    doc.lastError = null;
    const email = text(doc.buyer, '/email');
    return email && doc.nfseNumber ? { kind: 'issued', email, number: doc.nfseNumber, docId: doc.id } : { kind: 'none' };
  }

  /** Mantém o documento na fila com espera exponencial. */
  private retryLater(doc: NfseDocument, error: string, now: Date): Notice {
    doc.status = status.QUEUED;
    doc.lastError = error;
    doc.nextAttemptAt = backoff(doc.attempts, now);
    return { kind: 'none' };
  }

  /** Caminho de cancelamento (evento e101101). */
  private async cancel(doc: NfseDocument, now: Date): Promise<void> {
    const key = doc.accessKey;
    if (!key) { doc.status = status.VOIDED; return; }
    const request: CancelRequest = {
      environment: this.config.environment,
      appVersion: this.config.appVersion,
      requestedAt: brasilia(now),
      sellerCnpj: this.config.seller.cnpj,
      accessKey: key,
      reasonCode: '9',
      reason: doc.cancelReason ?? 'Cancelamento solicitado pelo prestador',
    };
    const signed = cancelDocument(request, this.identity.signatureFor(cancelId(request), cancelCanonicalInf(request)));
    doc.cancelXml = signed;
    doc.attempts += 1;
    try {
      await this.gateway.submitEvent(key, signed);
      doc.status = status.CANCELED;
      doc.canceledAt = now;
      doc.lastError = null;
    } catch (e) {
      doc.lastError = e instanceof Error ? e.message : String(e);
      if (doc.attempts >= MAX_CANCEL_ATTEMPTS) doc.status = status.CANCEL_FAILED;
      else doc.nextAttemptAt = backoff(doc.attempts, now);
    }
  }
}

/**
 * Reage a um estorno ou chargeback do pagamento de um documento.
 * Integral: notas emitidas vão para cancelamento, não emitidas são anuladas. Parcial de nota emitida: substituição manual.
 */
export async function onReversal(store: NfseStore, paymentId: string, full: boolean, reason: string): Promise<void> {
  const doc = await store.findByPaymentId(paymentId);
  if (!doc) return;
  const issued = doc.status === status.ISSUED;
  let next: string;
  if (issued && full) next = status.CANCEL_QUEUED;
  else if (issued && !full) next = status.NEEDS_REVIEW;
  else if (!issued && full && ([status.QUEUED, status.PENDING_DATA, status.REJECTED] as string[]).includes(doc.status)) next = status.VOIDED;
  else if (!issued && !full && doc.status !== status.VOIDED && doc.status !== status.CANCELED) next = status.NEEDS_REVIEW;
  else return;
  doc.status = next;
  doc.cancelReason = reason;
  doc.attempts = 0;
  doc.nextAttemptAt = new Date();
  await store.save(doc);
}

/** Guarda uma identidade fiscal e devolve à fila os documentos do cliente que esperavam por ela. */
export async function saveIdentity(store: NfseStore, identity: FiscalIdentity): Promise<number> {
  await store.upsertIdentity(identity);
  const pending = await store.pendingDataForCustomer(identity.customerId);
  for (const doc of pending) {
    doc.status = status.QUEUED;
    doc.nextAttemptAt = new Date();
    doc.lastError = null;
    await store.save(doc);
  }
  return pending.length;
}
