import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface Coupon { code: string; percentOff: number; planIds: string[] | null; maxRedemptions: number | null; expiresAt: Date | null; active: boolean; createdBy: string; createdAt: Date }

export const normalizeCoupon = (raw: string) => raw.trim().toUpperCase();
const row = (r: Record<string, unknown>): Coupon => ({
  code: r.code as string, percentOff: Number(r.percent_off), planIds: (r.plan_ids as string[] | null) ?? null, maxRedemptions: (r.max_redemptions as number | null) ?? null,
  expiresAt: r.expires_at ? new Date(r.expires_at as string) : null, active: !!r.active, createdBy: r.created_by as string, createdAt: new Date(r.created_at as string),
});

/** Cupons de desconto percentual: validade, planos elegíveis e limite de usos pagos. */
export class Coupons {
  constructor(private db: DataSource) {}

  async list() {
    const rows: Record<string, unknown>[] = await this.db.query(`SELECT c.*,
        (SELECT count(*)::int FROM subscriptions s WHERE s."couponCode" = c.code AND s."paidAt" IS NOT NULL AND s."grantedBy" IS NULL) AS redemptions,
        (SELECT coalesce(sum(amount), 0)::bigint FROM subscriptions s WHERE s."couponCode" = c.code AND s."paidAt" IS NOT NULL AND s."grantedBy" IS NULL AND s."canceledAt" IS NULL) AS revenue,
        (SELECT coalesce(sum(discount), 0)::bigint FROM subscriptions s WHERE s."couponCode" = c.code AND s."paidAt" IS NOT NULL AND s."grantedBy" IS NULL) AS discounted
      FROM coupons c ORDER BY c.created_at DESC`);
    return rows.map((r) => ({ ...row(r), redemptions: Number(r.redemptions), revenueCents: Number(r.revenue), discountCents: Number(r.discounted) }));
  }

  async create(c: Omit<Coupon, 'active' | 'createdAt'>) {
    const code = normalizeCoupon(c.code);
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new BadRequestException('Código inválido: use 3 a 32 letras, números, - ou _');
    const [exists] = await this.db.query(`SELECT 1 FROM coupons WHERE code = $1`, [code]);
    if (exists) throw new BadRequestException('Já existe um cupom com esse código');
    await this.db.query(`INSERT INTO coupons (code, percent_off, plan_ids, max_redemptions, expires_at, created_by) VALUES ($1, $2, $3, $4, $5, $6)`,
      [code, c.percentOff, c.planIds?.length ? c.planIds : null, c.maxRedemptions, c.expiresAt, c.createdBy]);
    return code;
  }

  async setActive(code: string, active: boolean) {
    const r = await this.db.query(`UPDATE coupons SET active = $2 WHERE code = $1 RETURNING code`, [normalizeCoupon(code), active]);
    const rows = Array.isArray(r[0]) ? r[0] : r;
    if (!rows.length) throw new NotFoundException();
  }

  /** Valida um cupom para um plano; lança 400 com a mensagem exibida ao aluno. */
  async resolve(raw: string, planId: string): Promise<Coupon> {
    const code = normalizeCoupon(raw);
    const [r] = /^[A-Z0-9_-]{3,32}$/.test(code) ? await this.db.query(`SELECT * FROM coupons WHERE code = $1`, [code]) : [];
    const c = r ? row(r) : null;
    if (!c || !c.active) throw new BadRequestException('Cupom inválido');
    if (c.expiresAt && c.expiresAt <= new Date()) throw new BadRequestException('Cupom expirado');
    if (c.planIds && !c.planIds.includes(planId)) throw new BadRequestException('Cupom não vale para este plano');
    if (c.maxRedemptions) {
      const [{ n }] = await this.db.query(`SELECT count(*)::int AS n FROM subscriptions WHERE "couponCode" = $1 AND "paidAt" IS NOT NULL AND "grantedBy" IS NULL`, [code]);
      if (n >= c.maxRedemptions) throw new BadRequestException('Cupom esgotado');
    }
    return c;
  }
}

/** Mensagens em pt-BR para os motivos de recusa do Mercado Pago. */
export function paymentMessage(detail: string | null | undefined): string {
  const m: Record<string, string> = {
    cc_rejected_bad_filled_card_number: 'Confira o número do cartão.',
    cc_rejected_bad_filled_date: 'Confira a validade do cartão.',
    cc_rejected_bad_filled_security_code: 'Confira o código de segurança (CVV).',
    cc_rejected_bad_filled_other: 'Confira os dados do cartão.',
    cc_rejected_blacklist: 'Não foi possível processar este cartão. Use outro cartão ou o Pix.',
    cc_rejected_call_for_authorize: 'O banco pediu autorização: ligue para o emissor do cartão e tente de novo.',
    cc_rejected_card_disabled: 'Cartão inativo. Ative-o com o emissor ou use outro cartão.',
    cc_rejected_duplicated_payment: 'Você já fez um pagamento com esse valor. Se precisar pagar de novo, use outro cartão ou o Pix.',
    cc_rejected_high_risk: 'Pagamento recusado pela análise de segurança. Tente o Pix ou outro cartão.',
    cc_rejected_insufficient_amount: 'Limite insuficiente. Tente menos parcelas, outro cartão ou o Pix.',
    cc_rejected_invalid_installments: 'Este cartão não aceita esse parcelamento.',
    cc_rejected_max_attempts: 'Limite de tentativas atingido. Use outro cartão ou o Pix.',
    cc_rejected_other_reason: 'O banco recusou o pagamento. Use outro cartão ou o Pix.',
    pending_contingency: 'Estamos processando o pagamento. Em até 2 dias úteis avisamos por e-mail.',
    pending_review_manual: 'Pagamento em análise. Em até 2 dias úteis avisamos por e-mail.',
    pending_waiting_transfer: 'Aguardando o pagamento do Pix.',
  };
  return (detail && m[detail]) || 'Não foi possível concluir o pagamento. Revise os dados ou tente outra forma de pagamento.';
}
