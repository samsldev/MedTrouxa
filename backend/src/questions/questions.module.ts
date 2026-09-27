import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Repository } from 'typeorm';
import { AdminOnly, CurrentUser, JwtUser } from '../common/auth';
import { Answer, Question } from '../database/entities';
import { RedisService } from '../redis/redis.module';

export class QuestionFilter {
  @IsOptional() @Type(() => Number) @IsInt() subjectId?: number;
  @IsOptional() @Type(() => Number) @IsInt() topicId?: number;
  @IsOptional() @IsString() institution?: string;
  @IsOptional() @Type(() => Number) @IsInt() year?: number;
  @IsOptional() @IsIn(['easy', 'medium', 'hard']) difficulty?: string;
  @IsOptional() @IsIn(['all', 'unanswered', 'wrong']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number;
}

class AltDto { @IsString() key: string; @IsString() text: string }
class CreateQuestionDto {
  @IsString() statement: string;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => AltDto) alternatives: AltDto[];
  @IsString() correctKey: string;
  @IsString() commentary: string;
  @IsInt() topicId: number;
  @IsOptional() @IsString() institution?: string;
  @IsOptional() @IsInt() year?: number;
  @IsOptional() @IsIn(['easy', 'medium', 'hard']) difficulty?: 'easy' | 'medium' | 'hard';
}
class AnswerDto { @IsString() chosenKey: string }

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(Question) private questions: Repository<Question>,
    @InjectRepository(Answer) private answers: Repository<Answer>,
    private redis: RedisService,
  ) {}

  query(userId: string, f: QuestionFilter) {
    const qb = this.questions.createQueryBuilder('q').leftJoinAndSelect('q.topic', 't');
    if (f.topicId) qb.andWhere('q.topicId = :topicId', { topicId: f.topicId });
    else if (f.subjectId) qb.andWhere('t.subjectId = :subjectId', { subjectId: f.subjectId });
    if (f.institution) qb.andWhere('q.institution ILIKE :inst', { inst: `%${f.institution}%` });
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

  async answer(userId: string, questionId: number, chosenKey: string, examId: string | null = null) {
    const q = await this.questions.findOne({ where: { id: questionId }, select: ['id', 'correctKey', 'commentary'] });
    if (!q) throw new NotFoundException();
    const correct = q.correctKey === chosenKey;
    await this.answers.insert({ userId, questionId, chosenKey, correct, examId });
    await this.redis.addXp(userId, correct ? 10 : 2);
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
  answer(@CurrentUser() u: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AnswerDto) {
    return this.svc.answer(u.sub, id, dto.chosenKey);
  }

  @Get(':id/stats') stats(@Param('id', ParseIntPipe) id: number) { return this.svc.distribution(id); }

  @AdminOnly() @Post() create(@Body() dto: CreateQuestionDto) { return this.questions.save(this.questions.create(dto)); }
}

@Module({
  imports: [TypeOrmModule.forFeature([Question, Answer])],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
