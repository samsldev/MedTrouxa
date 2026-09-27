import { Body, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Repository } from 'typeorm';
import { AdminOnly, CurrentUser, JwtUser } from '../common/auth';
import { Answer, Question } from '../database/entities';
import { BillingModule, BillingService } from '../billing/billing.module';
import { RedisService } from '../redis/redis.module';
import { RateLimit } from '../security/rate-limit';

/** Escapa curingas do LIKE para buscas literais */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export class QuestionFilter {
  @IsOptional() @Type(() => Number) @IsInt() subjectId?: number;
  @IsOptional() @Type(() => Number) @IsInt() topicId?: number;
  @IsOptional() @IsString() @MaxLength(80) institution?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100) year?: number;
  @IsOptional() @IsIn(['easy', 'medium', 'hard']) difficulty?: string;
  @IsOptional() @IsIn(['all', 'unanswered', 'wrong']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

class AltDto { @IsString() @Matches(/^[A-E]$/) key: string; @IsString() @Length(1, 2000) text: string }
class CreateQuestionDto {
  @IsString() @Length(10, 10000) statement: string;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => AltDto) alternatives: AltDto[];
  @IsString() @Matches(/^[A-E]$/) correctKey: string;
  @IsString() @Length(1, 20000) commentary: string;
  @IsInt() topicId: number;
  @IsOptional() @IsString() @MaxLength(80) institution?: string;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) year?: number;
  @IsOptional() @IsIn(['easy', 'medium', 'hard']) difficulty?: 'easy' | 'medium' | 'hard';
}
class AnswerDto { @IsString() @Matches(/^[A-E]$/) chosenKey: string }

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(Question) private questions: Repository<Question>,
    @InjectRepository(Answer) private answers: Repository<Answer>,
    private redis: RedisService,
    private billing: BillingService,
  ) {}

  query(userId: string, f: QuestionFilter) {
    const qb = this.questions.createQueryBuilder('q').leftJoinAndSelect('q.topic', 't');
    if (f.topicId) qb.andWhere('q.topicId = :topicId', { topicId: f.topicId });
    else if (f.subjectId) qb.andWhere('t.subjectId = :subjectId', { subjectId: f.subjectId });
    if (f.institution) qb.andWhere("q.institution ILIKE :inst ESCAPE '\\'", { inst: `%${likeEscape(f.institution)}%` });
    if (f.year) qb.andWhere('q.year = :year', { year: f.year });
    if (f.difficulty) qb.andWhere('q.difficulty = :diff', { diff: f.difficulty });
    if (f.status === 'unanswered') {
      qb.andWhere('NOT EXISTS (SELECT 1 FROM answers a WHERE a."questionId" = q.id AND a."userId" = :uid)', { uid: userId });
    } else if (f.status === 'wrong') {
      qb.andWhere(`EXISTS (SELECT 1 FROM answers a WHERE a."questionId" = q.id AND a."userId" = :uid AND a.correct = false
        AND a.id = (SELECT max(a2.id) FROM answers a2 WHERE a2."questionId" = q.id AND a2."userId" = :uid))`, { uid: userId });
    }
    return qb;
  }

  async list(userId: string, f: QuestionFilter) {
    const limit = Math.min(f.limit ?? 10, 50);
    const page = Math.max(f.page ?? 1, 1);
    const [items, total] = await this.query(userId, f).orderBy('q.id').skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit };
  }

  async answer(user: JwtUser, questionId: number, chosenKey: string) {
    const userId = user.sub;
    const q = await this.questions.findOne({ where: { id: questionId }, select: ['id', 'correctKey', 'commentary'] });
    if (!q) throw new NotFoundException();
    // Limite diário do plano gratuito
    const { answersPerDay } = await this.billing.limits(user);
    if (answersPerDay !== null) {
      const key = `ans:${userId}:${new Date().toISOString().slice(0, 10)}`;
      const n = await this.redis.client.incr(key).catch(() => 0);
      if (n === 1) await this.redis.client.expire(key, 26 * 3600).catch(() => undefined);
      if (n > answersPerDay) {
        throw new ForbiddenException({ code: 'PLAN_REQUIRED', feature: 'answers', message: `Você atingiu o limite de ${answersPerDay} questões por dia do plano gratuito.` });
      }
    }
    const firstTime = !(await this.answers.existsBy({ userId, questionId }));
    const correct = q.correctKey === chosenKey;
    await this.answers.insert({ userId, questionId, chosenKey, correct, examId: null });
    // XP só na primeira resposta de cada questão (evita manipulação do ranking)
    if (firstTime) await this.redis.addXp(userId, correct ? 10 : 2);
    await this.redis.invalidate(`stats:${userId}`);
    return { correct, correctKey: q.correctKey, commentary: q.commentary };
  }

  /** Estatística da comunidade: % de marcação por alternativa */
  distribution(questionId: number) {
    return this.redis.cached(`qdist:${questionId}`, 300, async () => {
      const rows = await this.answers.createQueryBuilder('a')
        .select('a.chosenKey', 'key').addSelect('count(*)::int', 'count')
        .where('a.questionId = :questionId', { questionId }).groupBy('a.chosenKey').getRawMany<{ key: string; count: number }>();
      const total = rows.reduce((s, r) => s + r.count, 0);
      return { total, byKey: Object.fromEntries(rows.map((r) => [r.key, total ? Math.round((r.count / total) * 100) : 0])) };
    });
  }
}

@Controller('questions')
class QuestionsController {
  constructor(private svc: QuestionsService, @InjectRepository(Question) private questions: Repository<Question>) {}

  @Get() list(@CurrentUser() u: JwtUser, @Query() f: QuestionFilter) { return this.svc.list(u.sub, f); }

  @Get('institutions')
  async institutions() {
    const rows = await this.questions.createQueryBuilder('q').select('DISTINCT q.institution', 'i')
      .where('q.institution IS NOT NULL').orderBy('i').getRawMany<{ i: string }>();
    return rows.map((r) => r.i);
  }

  @Get(':id') async one(@Param('id', ParseIntPipe) id: number) {
    const q = await this.questions.findOneBy({ id });
    if (!q) throw new NotFoundException();
    return q;
  }

  @Post(':id/answer')
  @RateLimit({ limit: 60, windowSec: 60, key: 'user' })
  answer(@CurrentUser() u: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AnswerDto) {
    return this.svc.answer(u, id, dto.chosenKey);
  }

  @Get(':id/stats') stats(@Param('id', ParseIntPipe) id: number) { return this.svc.distribution(id); }

  @AdminOnly() @Post() create(@Body() dto: CreateQuestionDto) { return this.questions.save(this.questions.create(dto)); }
}

@Module({
  imports: [TypeOrmModule.forFeature([Question, Answer]), BillingModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
