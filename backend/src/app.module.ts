import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { JwtGuard, Public } from './common/auth';
import { dataSourceOptions } from './database/data-source';
import { ExamsModule } from './exams/exams.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { QuestionsModule } from './questions/questions.module';
import { RedisModule, RedisService } from './redis/redis.module';
import { StatsModule } from './stats/stats.module';
import { StudyPlansModule } from './study-plans/study-plans.module';
import { SubjectsModule } from './subjects/subjects.module';

@Controller('health')
class HealthController {
  constructor(@InjectDataSource() private db: DataSource, private redis: RedisService) {}

  @Public() @Get()
  async check() {
    const [db] = await this.db.query('SELECT pg_is_in_recovery() AS replica, inet_server_addr()::text AS node').catch(() => [null]);
    const redis = await this.redis.client.ping().catch(() => 'down');
    return { status: db && redis === 'PONG' ? 'ok' : 'degraded', db, redis };
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: dataSourceOptions }),
    JwtModule.register({ global: true, secret: process.env.JWT_SECRET ?? 'dev-secret', signOptions: { expiresIn: '7d' } }),
    RedisModule, AuthModule, SubjectsModule, QuestionsModule, FlashcardsModule, ExamsModule, StudyPlansModule, StatsModule, AiModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: JwtGuard }],
})
export class AppModule {}
