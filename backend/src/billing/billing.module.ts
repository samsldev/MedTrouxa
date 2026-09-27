import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpCode, Injectable, Logger, Module, NotFoundException,
  Param, ParseUUIDPipe, Post, Query, ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { Equals, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import * as QRCode from 'qrcode';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { CurrentUser, JwtUser, Public } from '../common/auth';
import { appUrl, isProd } from '../config/env';
import { Subscription, User } from '../database/entities';
import { securityEvent } from '../security/logging';
import { RateLimit } from '../security/rate-limit';
import { NfseEngine, NfseModule } from '../nfse/nfse.module';
import { Limits, LIMITS, Tier } from './entitlements';
import { Coupons, normalizeCoupon, paymentMessage } from './coupons';
import { MercadoPago, MpPayment, MpRejected } from './mercadopago';
import { digits, validCnpj, validCpf } from '../nfse/dps';
import { saveIdentity } from '../nfse/service';
import { planById, PLANS } from './plans';

class CheckoutDto {
  @IsString() planId: string;
  @IsIn(['pix', 'card']) paymentMethod: 'pix' | 'card';
  @IsInt() @Min(1) @Max(12) installments: number;
  /** Atribuição de marketing (UTM e variação de landing) capturada pelo rastreador */
  @IsOptional() @IsString() @MaxLength(100) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(100) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(100) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(60) lp?: string;
}

class PayerDto {
  @IsString() @MinLength(5) @MaxLength(120) @Matches(/^\S+(\s+\S+)+$/, { message: 'Informe nome e sobrenome' }) name: string;
  @IsIn(['cpf', 'cnpj']) docType: 'cpf' | 'cnpj';
  @IsString() @MaxLength(20) docNumber: string;
  @IsOptional() @IsString() @Matches(/^[\d\s()+-]{10,20}$/, { message: 'Celular inválido' }) phone?: string;
}
class CardDto {
  /** Token do cartão gerado no navegador pelo MercadoPago.js (o número do cartão nunca passa pelo nosso servidor) */
  @IsString() @MaxLength(64) token: string;
  @IsString() @Matches(/^[a-z0-9_]{2,30}$/) paymentMethodId: string;
  @IsOptional() @IsString() @Matches(/^\d{1,12}$/) issuerId?: string;
}
class PayDto extends CheckoutDto {
  @ValidateNested() @Type(() => PayerDto) payer: PayerDto;
  @IsOptional() @ValidateNested() @Type(() => CardDto) card?: CardDto;
  @IsOptional() @IsString() @MaxLength(32) coupon?: string;
  @IsOptional() @IsString() @MaxLength(100) deviceId?: string;
  @IsBoolean() @Equals(true, { message: 'Aceite os termos de uso e a política de privacidade' }) acceptTerms: boolean;
}

const provider = () => (process.env.PAYMENT_PROVIDER ?? 'fake') as 'fake' | 'mercadopago';

@Injectable()
export class BillingService {
  private log = new Logger('Billing');
  private mp = new MercadoPago();
  constructor(
    @InjectRepository(Subscription) private subs: Repository<Subscription>,
    @InjectRepository(User) private users: Repository<User>,
    private nfse: NfseEngine,
    @InjectDataSource() private db: DataSource,
  ) { this.coupons = new Coupons(db); }
  readonly coupons: Coupons;

  /** Enfileira a NFS-e da cobrança aprovada (idempotente: um documento por assinatura). */
  private async enqueueInvoice(sub: Subscription, paymentId: string, paidCents: number, paidAt: Date, payer?: { name?: string | null; email?: string | null; identification?: { type?: string | null; number?: string | null } | null }) {
    const plan = planById(sub.planId)!;
    const user = await this.users.findOneBy({ id: sub.userId });
    await this.nfse.onPaid({
      sourceId: sub.id,
      paymentId,
      userId: sub.userId,
      amountCents: paidCents,
      currency: 'brl',
      paidAt,
      buyerName: user?.name ?? payer?.name ?? null,
      buyerEmail: user?.email ?? payer?.email ?? null,
      payerIdentification: payer?.identification ?? null,
      lines: [
        `Plano ${plan.name} (${plan.accessYears > 1 ? `${plan.accessYears} anos de acesso` : '1 ano de acesso'})`,
        sub.paymentMethod === 'pix' ? 'Pix à vista' : sub.installments > 1 ? `cartão em ${sub.installments}x` : 'cartão à vista',
      ],
    });
  }

  active(userId: string) {
    return this.subs.findOne({ where: { userId, status: 'active', expiresAt: MoreThan(new Date()) }, order: { expiresAt: 'DESC' } });
  }

  /** Plano efetivo do usuário (admins têm acesso total) */
  async tier(user: { sub: string; role?: string }): Promise<Tier> {
    if (user.role === 'admin') return 'arcano';
    const sub = await this.active(user.sub);
    return (sub?.planId as Tier) ?? 'free';
  }

  async limits(user: { sub: string; role?: string }): Promise<Limits & { tier: Tier }> {
    const tier = await this.tier(user);
    return { tier, ...LIMITS[tier] };
  }

  /** Lança 403 com mensagem de upgrade se o recurso não estiver no plano */
  async require(user: { sub: string; role?: string }, feature: 'exams' | 'studyPlans', message: string) {
    const l = await this.limits(user);
    if (!l[feature]) throw new ForbiddenException({ message, code: 'PLAN_REQUIRED', feature });
  }

  private amountFor(planId: string, method: 'pix' | 'card', installments: number) {
    const plan = planById(planId);
    if (!plan) throw new NotFoundException('Plano inexistente');
    if (method === 'pix' && installments !== 1) throw new BadRequestException('Pix é somente à vista');
    if (installments > plan.maxInstallments) throw new BadRequestException('Parcelamento inválido');
    // À vista = preço à vista. Parcelado (2x–12x) = 12 × parcela anunciada.
    const amount = installments === 1 ? plan.cashPrice : plan.installmentPrice * plan.maxInstallments;
    return { plan, amount };
  }

  /** Preço com cupom (o desconto vale para Pix e cartão). */
  async quote(planId: string, method: 'pix' | 'card', installments: number, coupon?: string) {
    const { plan, amount: gross } = this.amountFor(planId, method, installments);
    const c = coupon?.trim() ? await this.coupons.resolve(coupon, plan.id) : null;
    const discount = c ? Math.round((gross * c.percentOff) / 100) : 0;
    return { plan, gross, discount, amount: gross - discount, coupon: c };
  }

  /** Tabela de preços com o cupom aplicado, para a página de checkout. */
  async couponPreview(code: string, planId: string) {
    const plan = planById(planId);
    if (!plan) throw new NotFoundException('Plano inexistente');
    const c = await this.coupons.resolve(code, plan.id);
    const off = (v: number) => v - Math.round((v * c.percentOff) / 100);
    return { code: c.code, percentOff: c.percentOff, cashPrice: off(plan.cashPrice), installmentTotal: off(plan.installmentPrice * plan.maxInstallments) };
  }

  /**
   * Checkout transparente: cobra no próprio site (cartão tokenizado ou Pix) sem redirecionar.
   * Pagamento aprovado na hora já libera o acesso; o webhook continua sendo a fonte da verdade para Pix e análises.
   */
  async pay(u: JwtUser, dto: PayDto) {
    const method = dto.paymentMethod;
    if (method === 'card' && !dto.card) throw new BadRequestException('Dados do cartão ausentes');
    const doc = digits(dto.payer.docNumber);
    if (!(dto.payer.docType === 'cpf' ? validCpf(doc) : validCnpj(doc))) throw new BadRequestException(`${dto.payer.docType.toUpperCase()} inválido`);
    const q = await this.quote(dto.planId, method, dto.installments, dto.coupon);
    const user = await this.users.findOneByOrFail({ id: u.sub });

    // Identidade fiscal: o mesmo CPF/CNPJ vai para o Mercado Pago e para a NFS-e
    await saveIdentity(this.nfse.store, { customerId: u.sub, userId: u.sub, docType: dto.payer.docType, docNumber: doc, updatedAt: new Date() });

    const sub = await this.subs.save(this.subs.create({
      userId: u.sub, planId: q.plan.id, paymentMethod: method, installments: dto.installments, amount: q.amount, discount: q.discount,
      couponCode: q.coupon?.code ?? null, status: 'pending', provider: provider(),
      utmSource: dto.utmSource ?? null, utmMedium: dto.utmMedium ?? null, utmCampaign: dto.utmCampaign ?? null, lp: dto.lp ?? null,
    }));
    const title = `MedTrouxa — Plano ${q.plan.name} (${q.plan.accessYears > 1 ? `${q.plan.accessYears} anos` : '1 ano'})`;

    let pay: MpPayment;
    if (provider() === 'fake') {
      if (isProd()) throw new ServiceUnavailableException('Pagamentos indisponíveis');
      pay = await this.fakePayment(sub, method, dto.card?.token);
    } else {
      const [firstName, ...rest] = dto.payer.name.trim().split(/\s+/);
      const phone = dto.payer.phone ? digits(dto.payer.phone).replace(/^55(?=\d{10,11}$)/, '') : '';
      try {
        pay = await this.mp.createPayment({
          externalReference: sub.id, description: title, amount: q.amount / 100,
          notificationUrl: `${appUrl()}/api/billing/webhook/mercadopago`,
          payer: { email: user.email, firstName, lastName: rest.join(' '), docType: dto.payer.docType === 'cpf' ? 'CPF' : 'CNPJ', docNumber: doc,
            ...(phone.length >= 10 ? { phone: { area_code: phone.slice(0, 2), number: phone.slice(2) } } : {}) },
          item: { id: q.plan.id, title },
          card: method === 'card' ? { token: dto.card!.token, paymentMethodId: dto.card!.paymentMethodId, issuerId: dto.card!.issuerId, installments: dto.installments } : undefined,
          deviceId: dto.deviceId,
        });
      } catch (e) {
        if (!(e instanceof MpRejected)) throw e;
        await this.subs.update(sub.id, { status: 'failed', statusDetail: `validation:${e.message}` });
        securityEvent('billing.payment_rejected', { sub: sub.id, cause: e.message });
        return { subscriptionId: sub.id, status: 'failed' as const, message: 'Confira os dados do cartão e do titular.' };
      }
    }
    return this.applyPayment(sub, pay, user.name);
  }

  /** Aplica a resposta imediata do provedor ao pedido. */
  private async applyPayment(sub: Subscription, pay: MpPayment, buyerName: string) {
    if (pay.status === 'approved') {
      const paid = Math.round(pay.transaction_amount * 100);
      if (paid >= sub.amount) await this.enqueueInvoice(sub, String(pay.id), paid, pay.date_approved ? new Date(pay.date_approved) : new Date(), { name: buyerName, email: pay.payer?.email, identification: pay.payer?.identification });
      const done = await this.activate(sub.id, String(pay.id), paid);
      return { subscriptionId: sub.id, status: done.status, message: null };
    }
    const tx = pay.point_of_interaction?.transaction_data;
    const failed = ['rejected', 'cancelled'].includes(pay.status);
    await this.subs.update(sub.id, {
      status: failed ? 'failed' : 'pending', statusDetail: pay.status_detail ?? null, providerPaymentId: String(pay.id),
      ...(tx?.qr_code ? { pixQrCode: tx.qr_code, pixQrBase64: tx.qr_code_base64 ?? null, pixTicketUrl: tx.ticket_url ?? null, pixExpiresAt: pay.date_of_expiration ? new Date(pay.date_of_expiration) : null } : {}),
    });
    if (failed) securityEvent('billing.payment_rejected', { sub: sub.id, cause: pay.status_detail });
    return { subscriptionId: sub.id, status: failed ? 'failed' as const : 'pending' as const, message: paymentMessage(pay.status_detail) };
  }

  /** Provedor falso (desenvolvimento): cartão aprova na hora (token `fake-reject` recusa); Pix gera um QR de teste. */
  private async fakePayment(sub: Subscription, method: 'pix' | 'card', token?: string): Promise<MpPayment> {
    const base = { id: Date.now(), external_reference: sub.id, transaction_amount: sub.amount / 100, currency_id: 'BRL', date_approved: new Date().toISOString() };
    if (method === 'card') return token === 'fake-reject' ? { ...base, status: 'rejected', status_detail: 'cc_rejected_insufficient_amount' } : { ...base, status: 'approved', status_detail: 'accredited' };
    const code = `00020126580014BR.GOV.BCB.PIX0136medtrouxa-teste-${sub.id.slice(0, 8)}5204000053039865406${(sub.amount / 100).toFixed(2)}5802BR5909MEDTROUXA6009SAO PAULO62070503***6304ABCD`;
    const png = await QRCode.toDataURL(code, { margin: 1, width: 320 });
    return { ...base, status: 'pending', status_detail: 'pending_waiting_transfer', date_approved: null,
      date_of_expiration: new Date(Date.now() + 30 * 60_000).toISOString(),
      point_of_interaction: { transaction_data: { qr_code: code, qr_code_base64: png.replace(/^data:image\/png;base64,/, '') } } };
  }

  /** Desenvolvimento: simula a confirmação do Pix (em produção quem confirma é o webhook). */
  async fakeConfirm(userId: string, id: string) {
    if (isProd() || provider() !== 'fake') throw new NotFoundException();
    const sub = await this.subs.findOneBy({ id, userId });
    if (!sub || sub.status !== 'pending') throw new NotFoundException();
    const user = await this.users.findOneByOrFail({ id: userId });
    await this.enqueueInvoice(sub, `fake-${sub.id}`, sub.amount, new Date(), { name: user.name, email: user.email });
    await this.activate(sub.id, `fake-${sub.id}`, sub.amount);
  }

  async checkout(u: JwtUser, dto: CheckoutDto) {
    const { plan, amount } = this.amountFor(dto.planId, dto.paymentMethod, dto.installments);
    const sub = await this.subs.save(this.subs.create({
      userId: u.sub, planId: plan.id, paymentMethod: dto.paymentMethod, installments: dto.installments, amount,
      status: 'pending', provider: provider(),
      utmSource: dto.utmSource ?? null, utmMedium: dto.utmMedium ?? null, utmCampaign: dto.utmCampaign ?? null, lp: dto.lp ?? null,
    }));

    if (provider() === 'fake') {
      if (isProd()) throw new ServiceUnavailableException('Pagamentos indisponíveis');
      await this.enqueueInvoice(sub, `fake-${sub.id}`, amount, new Date(), { name: u.name, email: u.email });
      await this.activate(sub.id, `fake-${sub.id}`, amount);
      return { subscriptionId: sub.id, status: 'active' as const, redirectUrl: null };
    }

    const pref = await this.mp.createPreference({
      externalReference: sub.id,
      title: `MedTrouxa — Plano ${plan.name} (${plan.accessYears > 1 ? `${plan.accessYears} anos` : '1 ano'})`,
      amount: amount / 100,
      method: dto.paymentMethod,
      installments: dto.installments,
      payerEmail: u.email,
      backUrl: `${appUrl()}/pagamento/${sub.id}`,
      notificationUrl: `${appUrl()}/api/billing/webhook/mercadopago`,
    });
    return { subscriptionId: sub.id, status: 'pending' as const, redirectUrl: pref.init_point };
  }

  /** Ativa a assinatura (idempotente). Conta o acesso a partir do fim da assinatura vigente, se houver. */
  async activate(subscriptionId: string, paymentId: string, paidAmount: number) {
    const sub = await this.subs.findOneBy({ id: subscriptionId });
    if (!sub) throw new NotFoundException();
    if (sub.status === 'active') return sub;
    if (paidAmount < sub.amount) {
      securityEvent('billing.amount_mismatch', { sub: sub.id, expected: sub.amount, paid: paidAmount });
      sub.status = 'failed';
      return this.subs.save(sub);
    }
    const plan = planById(sub.planId)!;
    const current = await this.active(sub.userId);
    const start = current?.expiresAt && current.expiresAt > new Date() ? new Date(current.expiresAt) : new Date();
    const expires = new Date(start);
    expires.setFullYear(expires.getFullYear() + plan.accessYears);
    Object.assign(sub, { status: 'active', providerPaymentId: paymentId, paidAt: new Date(), startsAt: start, expiresAt: expires });
    await this.subs.save(sub);
    securityEvent('billing.activated', { sub: sub.id, user: sub.userId, plan: sub.planId });
    return sub;
  }

  /** Webhook do Mercado Pago: valida assinatura e confirma o pagamento consultando a API (nunca confia no corpo). */
  async mpWebhook(body: { type?: string; action?: string; data?: { id?: string | number } }, query: Record<string, string>, sig?: string, reqId?: string) {
    const dataId = String(body?.data?.id ?? query['data.id'] ?? '');
    if (!dataId || !/^\d{1,30}$/.test(dataId)) return;
    if (!this.mp.verifySignature(sig, reqId, dataId)) {
      securityEvent('billing.webhook_bad_signature', { dataId });
      throw new ForbiddenException();
    }
    if ((body?.type ?? query.type) !== 'payment') return;
    const pay = await this.mp.getPayment(dataId);
    const sub = await this.subs.findOneBy({ id: pay.external_reference });
    if (!sub) return;
    const paidCents = Math.round(pay.transaction_amount * 100);
    if (pay.status === 'approved' && pay.status_detail === 'partially_refunded') {
      // Estorno parcial de nota emitida: fica para substituição manual
      await this.nfse.onReversal(String(pay.id), false, 'Estorno parcial do pagamento');
    } else if (pay.status === 'approved' && pay.currency_id === 'BRL') {
      // NFS-e primeiro (idempotente): se falhar, o webhook devolve 500 e o Mercado Pago reentrega o evento inteiro
      if (paidCents >= sub.amount) {
        const payerName = [pay.payer?.first_name, pay.payer?.last_name].filter(Boolean).join(' ') || null;
        await this.enqueueInvoice(sub, String(pay.id), paidCents, pay.date_approved ? new Date(pay.date_approved) : new Date(),
          { name: payerName, email: pay.payer?.email, identification: pay.payer?.identification });
      }
      await this.activate(sub.id, String(pay.id), paidCents);
    } else if (['rejected', 'cancelled'].includes(pay.status) && sub.status === 'pending') {
      sub.status = 'failed';
      await this.subs.save(sub);
    } else if (['refunded', 'charged_back'].includes(pay.status)) {
      await this.nfse.onReversal(String(pay.id), true, pay.status === 'charged_back'
        ? 'Contestação do pagamento pelo titular do cartão (chargeback)'
        : 'Reembolso ao cliente (direito de arrependimento ou estorno)');
      if (sub.status !== 'active') return;
      sub.status = 'canceled';
      sub.canceledAt = new Date();
      await this.subs.save(sub);
      securityEvent('billing.revoked', { sub: sub.id, reason: pay.status });
    }
  }

  async status(userId: string, id: string) {
    const sub = await this.subs.findOneBy({ id, userId });
    if (!sub) throw new NotFoundException();
    const pixOpen = sub.status === 'pending' && sub.paymentMethod === 'pix' && sub.pixQrCode && (!sub.pixExpiresAt || sub.pixExpiresAt > new Date());
    return {
      id: sub.id, status: sub.status, planId: sub.planId, expiresAt: sub.expiresAt, method: sub.paymentMethod, installments: sub.installments, amount: sub.amount,
      message: sub.status === 'active' ? null : paymentMessage(sub.statusDetail),
      pix: pixOpen ? { qrCode: sub.pixQrCode, qrCodeBase64: sub.pixQrBase64, ticketUrl: sub.pixTicketUrl, expiresAt: sub.pixExpiresAt } : null,
      pixExpired: sub.status === 'pending' && sub.paymentMethod === 'pix' && !!sub.pixExpiresAt && sub.pixExpiresAt <= new Date(),
    };
  }
}

@Controller('billing')
class BillingController {
  constructor(private billing: BillingService) {}

  @Public() @Get('plans') plans() { return PLANS; }

  @Get('me')
  async me(@CurrentUser() u: JwtUser) {
    const sub = await this.billing.active(u.sub);
    return { subscription: sub, plan: sub ? planById(sub.planId) : null, limits: await this.billing.limits(u) };
  }

  @Post('checkout') @RateLimit({ limit: 10, windowSec: 600, key: 'user' })
  checkout(@CurrentUser() u: JwtUser, @Body() dto: CheckoutDto) { return this.billing.checkout(u, dto); }

  /** Configuração pública do checkout (chave pública do MP para tokenizar o cartão no navegador). */
  @Public() @Get('config')
  config() { return { provider: provider(), publicKey: provider() === 'mercadopago' ? process.env.MP_PUBLIC_KEY ?? null : null }; }

  @Get('coupons/:code') @RateLimit({ limit: 20, windowSec: 600, key: 'user' })
  coupon(@Param('code') code: string, @Query('planId') planId = '') { return this.billing.couponPreview(normalizeCoupon(code), planId); }

  @Post('pay') @RateLimit({ limit: 8, windowSec: 600, key: 'user' })
  pay(@CurrentUser() u: JwtUser, @Body() dto: PayDto) { return this.billing.pay(u, dto); }

  @Post('subscriptions/:id/dev-confirm') @HttpCode(204)
  devConfirm(@CurrentUser() u: JwtUser, @Param('id', ParseUUIDPipe) id: string) { return this.billing.fakeConfirm(u.sub, id); }

  @Get('subscriptions/:id') status(@CurrentUser() u: JwtUser, @Param('id', ParseUUIDPipe) id: string) { return this.billing.status(u.sub, id); }

  @Public() @Post('webhook/mercadopago') @HttpCode(200) @RateLimit({ limit: 120, windowSec: 60 })
  async webhook(@Body() body: Record<string, never>, @Query() q: Record<string, string>, @Headers('x-signature') sig?: string, @Headers('x-request-id') rid?: string) {
    await this.billing.mpWebhook(body, q, sig, rid);
    return { ok: true };
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, User]), NfseModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
