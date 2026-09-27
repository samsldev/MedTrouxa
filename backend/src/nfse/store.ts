/**
 * Armazenamento da NFS-e. Port 1:1 de faelith-web/src/nfse/store.rs (Postgres + versão em memória).
 *
 * - Um documento por cobrança paga (source_id único), então reentregas do webhook nunca duplicam uma nota
 * - Os números de DPS vêm de um contador atômico por série e são atribuídos uma única vez, no primeiro envio
 * - O trabalho vencido é reservado com um lease (next_attempt_at adiantado, SKIP LOCKED no Postgres)
 * - O XML emitido é guardado indefinidamente (guarda legal de pelo menos 5 anos); linhas nunca são apagadas
 * - As identidades fiscais guardam o CPF / CNPJ / NIF necessário para emitir notas para um cliente
 *
 * Adaptação ao MedTrouxa: stripe_invoice_id → source_id (id da assinatura), payment_intent → payment_id
 * (id do pagamento no Mercado Pago), org_id → user_id, stripe_customer_id → customer_id (id do usuário).
 */
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';

/** Estados do ciclo de vida de um documento. */
export const status = {
  /** Aguardando emissão (ou nova tentativa). */
  QUEUED: 'queued',
  /** Faltam dados do tomador (CPF / CNPJ); retoma quando o cliente completa. */
  PENDING_DATA: 'pending_data',
  ISSUED: 'issued',
  /** Rejeitada pelo sistema nacional; precisa de decisão do admin. */
  REJECTED: 'rejected',
  CANCEL_QUEUED: 'cancel_queued',
  CANCELED: 'canceled',
  CANCEL_FAILED: 'cancel_failed',
  /** Estornada antes de emitir: nenhuma nota será emitida. */
  VOIDED: 'voided',
  /** Estorno parcial de nota emitida: precisa de substituição manual. */
  NEEDS_REVIEW: 'needs_review',
} as const;

/** Uma NFS-e (ou a tentativa de emiti-la) para uma cobrança paga. */
export interface NfseDocument {
  id: string;
  sourceId: string;
  paymentId: string | null;
  userId: string | null;
  customerId: string | null;
  status: string;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  series: number;
  number: number | null;
  dpsId: string | null;
  accessKey: string | null;
  nfseNumber: string | null;
  amountUsdCents: number;
  amountBrlCents: number | null;
  ptaxRate: number | null;
  /** YYYY-MM-DD */
  ptaxDate: string | null;
  paidAt: Date;
  /** Retrato do tomador na cobrança: nome, e-mail, país, endereço, documentos. */
  buyer: Record<string, unknown>;
  description: string;
  dpsXml: string | null;
  nfseXml: string | null;
  cancelReason: string | null;
  cancelXml: string | null;
  createdAt: Date;
  issuedAt: Date | null;
  canceledAt: Date | null;
}

/** Identificação fiscal de um cliente. */
export interface FiscalIdentity {
  customerId: string;
  userId: string | null;
  /** `cpf`, `cnpj` ou `nif`. */
  docType: string;
  docNumber: string;
  updatedAt: Date;
}

/** Lease dado a um documento reservado antes que ele volte a ser reservável. */
export const CLAIM_LEASE_MINUTES = 10;

/** Armazenamento do módulo de NFS-e. */
export interface NfseStore {
  /** Insere um documento novo; false quando a cobrança já tem um. */
  enqueue(doc: NfseDocument): Promise<boolean>;
  /** Reserva até `limit` documentos vencidos (queued ou cancel_queued), com lease. */
  claimDue(now: Date, limit: number): Promise<NfseDocument[]>;
  /** Substitui um documento. */
  save(doc: NfseDocument): Promise<void>;
  get(id: string): Promise<NfseDocument | null>;
  findByPaymentId(paymentId: string): Promise<NfseDocument | null>;
  /** Mais recentes primeiro; filtros opcionais de status e usuário. */
  list(status: string | null, userId: string | null, limit: number): Promise<NfseDocument[]>;
  /** Documentos de um cliente aguardando dados fiscais. */
  pendingDataForCustomer(customer: string): Promise<NfseDocument[]>;
  /** Próximo número de DPS da série (1, 2, 3...), atomicamente. */
  allocateNumber(series: number): Promise<number>;
  upsertIdentity(identity: FiscalIdentity): Promise<void>;
  getIdentity(customer: string): Promise<FiscalIdentity | null>;
}

/** Documento novo com valores padrão (os chamadores preenchem o restante). */
export function newDocument(p: Pick<NfseDocument, 'sourceId' | 'series' | 'paidAt' | 'buyer' | 'description' | 'amountUsdCents' | 'amountBrlCents'> & Partial<NfseDocument>): NfseDocument {
  const now = new Date();
  return {
    id: randomUUID(), paymentId: null, userId: null, customerId: null, status: status.QUEUED, attempts: 0, nextAttemptAt: now,
    lastError: null, number: null, dpsId: null, accessKey: null, nfseNumber: null, ptaxRate: null, ptaxDate: null,
    dpsXml: null, nfseXml: null, cancelReason: null, cancelXml: null, createdAt: now, issuedAt: null, canceledAt: null,
    ...p,
  };
}

const clone = (d: NfseDocument): NfseDocument => ({ ...d, buyer: JSON.parse(JSON.stringify(d.buyer)) });

/** Armazenamento em memória (testes e desenvolvimento). */
export class MemoryNfse implements NfseStore {
  private docs = new Map<string, NfseDocument>();
  private series = new Map<number, number>();
  private identities = new Map<string, FiscalIdentity>();

  async enqueue(doc: NfseDocument) {
    if ([...this.docs.values()].some((d) => d.sourceId === doc.sourceId)) return false;
    this.docs.set(doc.id, clone(doc));
    return true;
  }
  async claimDue(now: Date, limit: number) {
    const due = [...this.docs.values()]
      .filter((d) => (d.status === status.QUEUED || d.status === status.CANCEL_QUEUED) && d.nextAttemptAt <= now)
      .slice(0, limit);
    return due.map((d) => { d.nextAttemptAt = new Date(now.getTime() + CLAIM_LEASE_MINUTES * 60_000); return clone(d); });
  }
  async save(doc: NfseDocument) { this.docs.set(doc.id, clone(doc)); }
  async get(id: string) { const d = this.docs.get(id); return d ? clone(d) : null; }
  async findByPaymentId(p: string) { const d = [...this.docs.values()].find((x) => x.paymentId === p); return d ? clone(d) : null; }
  async list(s: string | null, userId: string | null, limit: number) {
    return [...this.docs.values()].filter((d) => (!s || d.status === s) && (!userId || d.userId === userId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit).map(clone);
  }
  async pendingDataForCustomer(c: string) {
    return [...this.docs.values()].filter((d) => d.status === status.PENDING_DATA && d.customerId === c).map(clone);
  }
  async allocateNumber(series: number) { const n = (this.series.get(series) ?? 0) + 1; this.series.set(series, n); return n; }
  async upsertIdentity(i: FiscalIdentity) { this.identities.set(i.customerId, { ...i }); }
  async getIdentity(c: string) { const i = this.identities.get(c); return i ? { ...i } : null; }
}

/** Colunas na ordem de `mapDoc`. */
const DOC_COLUMNS = ['id', 'source_id', 'payment_id', 'user_id', 'customer_id', 'status', 'attempts', 'next_attempt_at', 'last_error',
  'series', 'number', 'dps_id', 'access_key', 'nfse_number', 'amount_usd_cents', 'amount_brl_cents', 'ptax_rate', 'ptax_date', 'paid_at',
  'buyer', 'description', 'dps_xml', 'nfse_xml', 'cancel_reason', 'cancel_xml', 'created_at', 'issued_at', 'canceled_at'];
const COLS = DOC_COLUMNS.map((c) => `"${c}"`).join(', ');
const PLACEHOLDERS = DOC_COLUMNS.map((_, i) => `$${i + 1}`).join(', ');

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const dateStr = (v: unknown) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

/** Converte uma linha de `nfse_documents`. */
function mapDoc(r: Row): NfseDocument {
  return {
    id: r.id as string, sourceId: r.source_id as string, paymentId: (r.payment_id as string) ?? null, userId: (r.user_id as string) ?? null,
    customerId: (r.customer_id as string) ?? null, status: r.status as string, attempts: Number(r.attempts), nextAttemptAt: new Date(r.next_attempt_at as string),
    lastError: (r.last_error as string) ?? null, series: Number(r.series), number: num(r.number), dpsId: (r.dps_id as string) ?? null,
    accessKey: (r.access_key as string) ?? null, nfseNumber: (r.nfse_number as string) ?? null, amountUsdCents: Number(r.amount_usd_cents),
    amountBrlCents: num(r.amount_brl_cents), ptaxRate: num(r.ptax_rate), ptaxDate: dateStr(r.ptax_date), paidAt: new Date(r.paid_at as string),
    buyer: (r.buyer as Record<string, unknown>) ?? {}, description: r.description as string, dpsXml: (r.dps_xml as string) ?? null,
    nfseXml: (r.nfse_xml as string) ?? null, cancelReason: (r.cancel_reason as string) ?? null, cancelXml: (r.cancel_xml as string) ?? null,
    createdAt: new Date(r.created_at as string), issuedAt: r.issued_at ? new Date(r.issued_at as string) : null,
    canceledAt: r.canceled_at ? new Date(r.canceled_at as string) : null,
  };
}

/** Todos os valores de um documento na ordem de `DOC_COLUMNS`. */
function bindDoc(d: NfseDocument): unknown[] {
  return [d.id, d.sourceId, d.paymentId, d.userId, d.customerId, d.status, d.attempts, d.nextAttemptAt, d.lastError, d.series, d.number,
    d.dpsId, d.accessKey, d.nfseNumber, d.amountUsdCents, d.amountBrlCents, d.ptaxRate, d.ptaxDate, d.paidAt, JSON.stringify(d.buyer),
    d.description, d.dpsXml, d.nfseXml, d.cancelReason, d.cancelXml, d.createdAt, d.issuedAt, d.canceledAt];
}

/** Armazenamento Postgres (no primário, via Pgpool). */
export class PostgresNfse implements NfseStore {
  constructor(private db: DataSource) {}

  async enqueue(doc: NfseDocument) {
    const rows: Row[] = await this.db.query(
      `INSERT INTO nfse_documents (${COLS}) VALUES (${PLACEHOLDERS}) ON CONFLICT (source_id) DO NOTHING RETURNING id`, bindDoc(doc));
    return rows.length > 0;
  }

  async claimDue(now: Date, limit: number) {
    const rows: Row[] = await this.db.query(
      `UPDATE nfse_documents SET next_attempt_at = $1::timestamptz + ($3 || ' minutes')::interval
       WHERE id IN (
         SELECT id FROM nfse_documents
         WHERE status IN ('queued', 'cancel_queued') AND next_attempt_at <= $1
         ORDER BY next_attempt_at LIMIT $2 FOR UPDATE SKIP LOCKED)
       RETURNING ${COLS}`, [now, limit, String(CLAIM_LEASE_MINUTES)]);
    // O driver devolve [linhas, contagem] em UPDATE ... RETURNING
    const list = Array.isArray(rows[0]) ? (rows[0] as unknown as Row[]) : rows;
    return list.map(mapDoc);
  }

  async save(doc: NfseDocument) {
    const updates = DOC_COLUMNS.filter((c) => c !== 'id').map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');
    await this.db.query(`INSERT INTO nfse_documents (${COLS}) VALUES (${PLACEHOLDERS}) ON CONFLICT (id) DO UPDATE SET ${updates}`, bindDoc(doc));
  }

  async get(id: string) {
    const rows: Row[] = await this.db.query(`SELECT ${COLS} FROM nfse_documents WHERE id = $1`, [id]);
    return rows[0] ? mapDoc(rows[0]) : null;
  }

  async findByPaymentId(paymentId: string) {
    const rows: Row[] = await this.db.query(`SELECT ${COLS} FROM nfse_documents WHERE payment_id = $1 LIMIT 1`, [paymentId]);
    return rows[0] ? mapDoc(rows[0]) : null;
  }

  async list(s: string | null, userId: string | null, limit: number) {
    const rows: Row[] = await this.db.query(
      `SELECT ${COLS} FROM nfse_documents WHERE ($1::text IS NULL OR status = $1) AND ($2::uuid IS NULL OR user_id = $2)
       ORDER BY created_at DESC LIMIT $3`, [s, userId, limit]);
    return rows.map(mapDoc);
  }

  async pendingDataForCustomer(customer: string) {
    const rows: Row[] = await this.db.query(`SELECT ${COLS} FROM nfse_documents WHERE status = 'pending_data' AND customer_id = $1`, [customer]);
    return rows.map(mapDoc);
  }

  async allocateNumber(series: number) {
    const rows: Row[] = await this.db.query(
      `INSERT INTO nfse_series (series, last_number) VALUES ($1, 1)
       ON CONFLICT (series) DO UPDATE SET last_number = nfse_series.last_number + 1
       RETURNING last_number`, [series]);
    return Number(rows[0].last_number);
  }

  async upsertIdentity(i: FiscalIdentity) {
    await this.db.query(
      `INSERT INTO fiscal_identities (customer_id, user_id, doc_type, doc_number, updated_at) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (customer_id) DO UPDATE SET
         user_id = COALESCE(EXCLUDED.user_id, fiscal_identities.user_id),
         doc_type = EXCLUDED.doc_type, doc_number = EXCLUDED.doc_number, updated_at = EXCLUDED.updated_at`,
      [i.customerId, i.userId, i.docType, i.docNumber, i.updatedAt]);
  }

  async getIdentity(customer: string) {
    const rows: Row[] = await this.db.query(
      `SELECT customer_id, user_id, doc_type, doc_number, updated_at FROM fiscal_identities WHERE customer_id = $1`, [customer]);
    const r = rows[0];
    return r ? { customerId: r.customer_id as string, userId: (r.user_id as string) ?? null, docType: r.doc_type as string, docNumber: r.doc_number as string, updatedAt: new Date(r.updated_at as string) } : null;
  }
}
