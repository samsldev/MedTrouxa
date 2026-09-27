import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccountModule } from './account/account.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { JwtGuard, Public } from './common/auth';
import { isProd } from './config/env';
import { dataSourceOptions } from './database/data-source';
import { ExamsModule } from './exams/exams.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { QuestionsModule } from './questions/questions.module';
import { RedisModule, RedisService } from './redis/redis.module';
import { AccessLogInterceptor } from './security/logging';
import { RateLimitGuard } from './security/rate-limit';
import { SocialModule } from './social/social.module';
import { StatsModule } from './stats/stats.module';
import { StudyPlansModule } from './study-plans/study-plans.module';
import { SubjectsModule } from './subjects/subjects.module';

@Controller('health')
class HealthController {
  constructor(@InjectDataSource() private db: DataSource, private redis: RedisService) {}

  /** Liveness/readiness. Em produção não expõe topologia do cluster. */
  @Public() @Get()
  async check() {
    const [db] = await this.db.query('SELECT pg_is_in_recovery() AS replica, inet_server_addr()::text AS node').catch(() => [null]);
    const redis = await this.redis.client.ping().catch(() => 'down');
    const status = db && redis === 'PONG' ? 'ok' : 'degraded';
    return isProd() ? { status } : { status, db, redis };
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: dataSourceOptions }),
    JwtModule.registerAsync({ global: true, useFactory: () => ({ secret: process.env.JWT_SECRET, signOptions: { algorithm: 'HS256' } }) }),
    RedisModule, AuthModule, AccountModule, SubjectsModule, QuestionsModule, FlashcardsModule, ExamsModule, StudyPlansModule,
    StatsModule, AiModule, BillingModule, SocialModule,
  ],
  controllers: [HealthController],
  providers: [
    // Ordem: autenticação → rate limit (o limite por usuário precisa de req.user)
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor },
  ],
})
export class AppModule {}
