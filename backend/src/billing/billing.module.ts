import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Post } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import { MoreThan, Repository } from 'typeorm';
import { CurrentUser, JwtUser, Public } from '../common/auth';
import { Subscription } from '../database/entities';
import { planById, PLANS } from './plans';

class CheckoutDto {
  @IsString() planId: string;
  @IsIn(['pix', 'card']) paymentMethod: 'pix' | 'card';
  @IsInt() @Min(1) @Max(12) installments: number;
}

@Injectable()
export class BillingService {
  constructor(@InjectRepository(Subscription) private subs: Repository<Subscription>) {}

  active(userId: string) {
    return this.subs.findOne({
      where: { userId, status: 'active', expiresAt: MoreThan(new Date()) },
      order: { expiresAt: 'DESC' },
    });
  }

  async checkout(userId: string, dto: CheckoutDto) {
    const plan = planById(dto.planId);
    if (!plan) throw new NotFoundException('Plano inexistente');
    if (dto.paymentMethod === 'pix' && dto.installments !== 1) throw new BadRequestException('Pix é somente à vista');
    // À vista (Pix ou 1x no cartão) = preço à vista. Parcelado (2x a 12x) = 12 × parcela anunciada, dividido em n vezes.
    const amount = dto.installments === 1 ? plan.cashPrice : plan.installmentPrice * plan.maxInstallments;
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + plan.accessYears);
    // TODO: integrar gateway (Stripe/Pagar.me/Mercado Pago); hoje a cobrança é simulada e aprovada na hora.
    return this.subs.save(this.subs.create({
      userId, planId: plan.id, paymentMethod: dto.paymentMethod, installments: dto.installments, amount, status: 'active', expiresAt,
    }));
  }
}

@Controller('billing')
class BillingController {
  constructor(private billing: BillingService) {}

  @Public() @Get('plans') plans() { return PLANS; }

  @Get('me')
  async me(@CurrentUser() u: JwtUser) {
    const sub = await this.billing.active(u.sub);
    return { subscription: sub, plan: sub ? planById(sub.planId) : null };
  }

  @Post('checkout') checkout(@CurrentUser() u: JwtUser, @Body() dto: CheckoutDto) { return this.billing.checkout(u.sub, dto); }
}

@Module({ imports: [TypeOrmModule.forFeature([Subscription])], controllers: [BillingController], providers: [BillingService], exports: [BillingService] })
export class BillingModule {}
