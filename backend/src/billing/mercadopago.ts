import { Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

const API = 'https://api.mercadopago.com';

export interface MpPreferenceInput {
  externalReference: string;
  title: string;
  amount: number; // em reais
  method: 'pix' | 'card';
  installments: number;
  payerEmail: string;
  backUrl: string;
  notificationUrl: string;
}

export interface MpPayment {
  id: number;
  status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back' | string;
  external_reference: string;
  transaction_amount: number;
  currency_id: string;
  status_detail?: string;
  date_approved?: string | null;
  payment_method_id?: string;
  date_of_expiration?: string | null;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } } | null;
  payer?: { email?: string | null; first_name?: string | null; last_name?: string | null; identification?: { type?: string | null; number?: string | null } | null } | null;
}

export class MpRejected extends Error {}

/** Pagamento do checkout transparente (POST /v1/payments). Cartão chega tokenizado pelo navegador. */
export interface MpPaymentInput {
  externalReference: string;
  description: string;
  amount: number; // em reais
  notificationUrl: string;
  payer: { email: string; firstName: string; lastName: string; docType: 'CPF' | 'CNPJ'; docNumber: string; phone?: { area_code: string; number: string } };
  item: { id: string; title: string };
  card?: { token: string; paymentMethodId: string; issuerId?: string; installments: number };
  pixExpiresAt?: Date;
  deviceId?: string;
}

/** Cliente mínimo da API do Mercado Pago (Checkout Pro e transparente), sem SDK. */
export class MercadoPago {
  private log = new Logger('MercadoPago');
  constructor(private token = process.env.MP_ACCESS_TOKEN ?? '', private webhookSecret = process.env.MP_WEBHOOK_SECRET ?? '') {}

  private async call<T>(path: string, init: RequestInit = {}, rejectable = false): Promise<T> {
    const res = await fetch(API + path, {
      ...init,
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok && rejectable && res.status >= 400 && res.status < 500) {
      // Dados do cartão/pagador recusados pela validação do MP: devolve algo tratável, sem detalhes sensíveis
      const body = (await res.json().catch(() => ({}))) as { message?: string; cause?: { code?: string | number }[] };
      this.log.warn(`MP ${path} -> ${res.status} ${body.cause?.map((c) => c.code).join(',') ?? ''}`);
      throw new MpRejected(String(body.cause?.[0]?.code ?? body.message ?? res.status));
    }
    if (!res.ok) {
      this.log.error(`MP ${path} -> ${res.status}`);
      throw new Error(`Mercado Pago indisponível (${res.status})`);
    }
    return res.json() as Promise<T>;
  }

  async createPreference(i: MpPreferenceInput): Promise<{ id: string; init_point: string }> {
    return this.call('/checkout/preferences', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': i.externalReference },
      body: JSON.stringify({
        items: [{ id: i.externalReference, title: i.title, quantity: 1, currency_id: 'BRL', unit_price: i.amount }],
        payer: { email: i.payerEmail },
        external_reference: i.externalReference,
        notification_url: i.notificationUrl,
        back_urls: { success: i.backUrl, pending: i.backUrl, failure: i.backUrl },
        auto_return: 'approved',
        statement_descriptor: 'MEDTROUXA',
        payment_methods: i.method === 'pix'
          ? { excluded_payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'ticket' }], installments: 1 }
          : { excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }], installments: i.installments, default_installments: i.installments },
      }),
    });
  }

  /** Cria o pagamento (cartão tokenizado ou Pix). A chave de idempotência evita cobrança dupla em reenvios. */
  createPayment(i: MpPaymentInput): Promise<MpPayment> {
    const payer = { email: i.payer.email, first_name: i.payer.firstName, last_name: i.payer.lastName, identification: { type: i.payer.docType, number: i.payer.docNumber } };
    return this.call('/v1/payments', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': i.externalReference, ...(i.deviceId ? { 'X-meli-session-id': i.deviceId } : {}) },
      body: JSON.stringify({
        transaction_amount: i.amount,
        description: i.description,
        external_reference: i.externalReference,
        notification_url: i.notificationUrl,
        statement_descriptor: 'MEDTROUXA',
        payer,
        additional_info: {
          items: [{ id: i.item.id, title: i.item.title, quantity: 1, unit_price: i.amount, category_id: 'learnings' }],
          payer: { first_name: i.payer.firstName, last_name: i.payer.lastName, ...(i.payer.phone ? { phone: i.payer.phone } : {}) },
        },
        ...(i.card
          ? { token: i.card.token, installments: i.card.installments, payment_method_id: i.card.paymentMethodId, ...(i.card.issuerId ? { issuer_id: Number(i.card.issuerId) } : {}), binary_mode: false }
          : { payment_method_id: 'pix', date_of_expiration: (i.pixExpiresAt ?? new Date(Date.now() + 30 * 60_000)).toISOString().replace('Z', '-00:00') }),
      }),
    }, true);
  }

  getPayment(id: string): Promise<MpPayment> {
    return this.call(`/v1/payments/${encodeURIComponent(id)}`);
  }

  /**
   * Valida a assinatura do webhook (header x-signature: "ts=...,v1=...").
   * Manifesto: `id:{data.id};request-id:{x-request-id};ts:{ts};` com HMAC-SHA256 da chave secreta.
   */
  verifySignature(signature: string | undefined, requestId: string | undefined, dataId: string): boolean {
    if (!signature || !this.webhookSecret) return false;
    const parts = Object.fromEntries(signature.split(',').map((p) => p.trim().split('=') as [string, string]));
    if (!parts.ts || !parts.v1) return false;
    // Rejeita notificações muito antigas (replay)
    const ts = Number(parts.ts);
    const ageMs = Math.abs(Date.now() - (ts > 1e12 ? ts : ts * 1000));
    if (!Number.isFinite(ts) || ageMs > 15 * 60 * 1000) return false;
    const manifest = `id:${dataId.toLowerCase()};${requestId ? `request-id:${requestId};` : ''}ts:${parts.ts};`;
    const expected = createHmac('sha256', this.webhookSecret).update(manifest).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(parts.v1, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
