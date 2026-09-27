import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpCode, Injectable, Logger, Module, NotFoundException,
  Param, ParseUUIDPipe, Post, Query, ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MoreThan, Repository } from 'typeorm';
import { CurrentUser, JwtUser, Public } from '../common/auth';
import { appUrl, isProd } from '../config/env';
import { Subscription, User } from '../database/entities';
import { securityEvent } from '../security/logging';
import { RateLimit } from '../security/rate-limit';
import { NfseEngine, NfseModule } from '../nfse/nfse.module';
import { Limits, LIMITS, Tier } from './entitlements';
import { MercadoPago } from './mercadopago';
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

const provider = () => (process.env.PAYMENT_PROVIDER ?? 'fake') as 'fake' | 'mercadopago';

@Injectable()
export class BillingService {
  private log = new Logger('Billing');
  private mp = new MercadoPago();
  constructor(
    @InjectRepository(Subscription) private subs: Repository<Subscription>,
    @InjectRepository(User) private users: Repository<User>,
    private nfse: NfseEngine,
  ) {}

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
    return { id: sub.id, status: sub.status, planId: sub.planId, expiresAt: sub.expiresAt };
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
