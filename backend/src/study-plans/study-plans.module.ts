import { Controller, Get, Module, NotFoundException, Param, ParseIntPipe, Post } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser, JwtUser } from '../common/auth';
import { PlanEnrollment, StudyPlan } from '../database/entities';
import { BillingModule, BillingService } from '../billing/billing.module';
import { RedisService } from '../redis/redis.module';

@Controller('study-plans')
class StudyPlansController {
  constructor(
    @InjectRepository(StudyPlan) private plans: Repository<StudyPlan>,
    @InjectRepository(PlanEnrollment) private enrollments: Repository<PlanEnrollment>,
    private redis: RedisService,
    private billing: BillingService,
  ) {}

  @Get() list() { return this.redis.cached('plans:all', 600, () => this.plans.find({ order: { id: 'ASC' } })); }

  @Get('mine') mine(@CurrentUser() u: JwtUser) {
    return this.enrollments.find({ where: { userId: u.sub }, order: { startedAt: 'DESC' } });
  }

  @Post(':id/enroll')
  async enroll(@CurrentUser() u: JwtUser, @Param('id', ParseIntPipe) planId: number) {
    if (!(await this.plans.existsBy({ id: planId }))) throw new NotFoundException();
    await this.billing.require(u, 'studyPlans', 'Cronogramas guiados fazem parte dos planos Alquimista e Arcano');
    const existing = await this.enrollments.findOneBy({ userId: u.sub, planId });
    return existing ?? this.enrollments.save(this.enrollments.create({ userId: u.sub, planId, completed: [] }));
  }

  @Post('enrollments/:id/items/:idx/toggle')
  async toggle(@CurrentUser() u: JwtUser, @Param('id', ParseIntPipe) id: number, @Param('idx', ParseIntPipe) idx: number) {
    const e = await this.enrollments.findOneBy({ id, userId: u.sub });
    if (!e || idx < 0 || idx >= e.plan.items.length) throw new NotFoundException();
    const done = new Set(e.completed);
    const rewarded = new Set(e.rewarded ?? []);
    if (done.has(idx)) done.delete(idx);
    else {
      done.add(idx);
      // XP só na primeira conclusão de cada tarefa
      if (!rewarded.has(idx)) { rewarded.add(idx); await this.redis.addXp(u.sub, 5); }
    }
    e.completed = [...done].sort((a, b) => a - b);
    e.rewarded = [...rewarded];
    return this.enrollments.save(e);
  }
}

@Module({ imports: [TypeOrmModule.forFeature([StudyPlan, PlanEnrollment]), BillingModule], controllers: [StudyPlansController] })
export class StudyPlansModule {}
