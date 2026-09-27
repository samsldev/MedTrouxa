import {
  BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { In, Repository } from 'typeorm';
import { CurrentUser, JwtUser } from '../common/auth';
import { Answer, Exam, ExamAnswer, Question } from '../database/entities';
import { RedisService } from '../redis/redis.module';

class CreateExamDto {
  @IsString() title: string;
  @IsInt() @Min(5) @Max(120) count: number;
  @IsInt() @Min(5) @Max(300) durationMinutes: number;
  @IsOptional() @IsInt() subjectId?: number;
  @IsOptional() @IsInt() topicId?: number;
  @IsOptional() @IsString() institution?: string;
}
class ExamAnswerDto { @IsInt() questionId: number; @IsOptional() @IsString() chosenKey?: string | null }
class SubmitDto { @IsArray() @ValidateNested({ each: true }) @Type(() => ExamAnswerDto) answers: ExamAnswerDto[] }

@Injectable()
class ExamsService {
  constructor(
    @InjectRepository(Exam) private exams: Repository<Exam>,
    @InjectRepository(Question) private questions: Repository<Question>,
    @InjectRepository(Answer) private answers: Repository<Answer>,
    private redis: RedisService,
  ) {}

  async create(userId: string, dto: CreateExamDto) {
    const qb = this.questions.createQueryBuilder('q').innerJoin('q.topic', 't').select('q.id', 'id');
    if (dto.topicId) qb.andWhere('q.topicId = :t', { t: dto.topicId });
    else if (dto.subjectId) qb.andWhere('t.subjectId = :s', { s: dto.subjectId });
    if (dto.institution) qb.andWhere('q.institution ILIKE :i', { i: `%${dto.institution}%` });
    const ids = (await qb.orderBy('random()').limit(dto.count).getRawMany<{ id: number }>()).map((r) => r.id);
    if (!ids.length) throw new BadRequestException('Nenhuma questão encontrada com esses filtros');
    return this.exams.save(this.exams.create({ userId, title: dto.title, questionIds: ids, durationMinutes: dto.durationMinutes }));
  }

  list(userId: string) {
    return this.exams.find({ where: { userId }, order: { startedAt: 'DESC' }, take: 50 });
  }

  async get(userId: string, id: string) {
    const exam = await this.exams.findOneBy({ id, userId });
    if (!exam) throw new NotFoundException();
    const qb = this.questions.createQueryBuilder('q').leftJoinAndSelect('q.topic', 't').whereInIds(exam.questionIds);
    if (exam.finishedAt) qb.addSelect(['q.correctKey', 'q.commentary']);
    const qs = await qb.getMany();
    const byId = new Map(qs.map((q) => [q.id, q]));
    return { ...exam, questions: exam.questionIds.map((qid) => byId.get(qid)).filter(Boolean) };
  }

  async submit(userId: string, id: string, dto: SubmitDto) {
    const exam = await this.exams.findOneBy({ id, userId });
    if (!exam) throw new NotFoundException();
    if (exam.finishedAt) throw new BadRequestException('Simulado já finalizado');
    const qs = await this.questions.find({ where: { id: In(exam.questionIds) }, select: ['id', 'correctKey'] });
    const chosen = new Map(dto.answers.map((a) => [a.questionId, a.chosenKey ?? null]));
    const results: ExamAnswer[] = qs.map((q) => {
      const c = chosen.get(q.id) ?? null;
      return { questionId: q.id, chosenKey: c, correct: c === q.correctKey };
    });
    const answered = results.filter((r) => r.chosenKey);
    if (answered.length) {
      await this.answers.insert(answered.map((r) => ({ userId, questionId: r.questionId, chosenKey: r.chosenKey!, correct: r.correct, examId: id })));
    }
    const correct = results.filter((r) => r.correct).length;
    exam.answers = results;
    exam.finishedAt = new Date();
    exam.score = Math.round((correct / exam.questionIds.length) * 100);
    await this.exams.save(exam);
    await this.redis.addXp(userId, correct * 10 + answered.length * 2);
    await this.redis.invalidate(`stats:${userId}`);
    return this.get(userId, id);
  }
}

@Controller('exams')
class ExamsController {
  constructor(private svc: ExamsService) {}
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateExamDto) { return this.svc.create(u.sub, dto); }
  @Get() list(@CurrentUser() u: JwtUser) { return this.svc.list(u.sub); }
  @Get(':id') get(@CurrentUser() u: JwtUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.get(u.sub, id); }
  @Post(':id/submit') submit(@CurrentUser() u: JwtUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitDto) {
    return this.svc.submit(u.sub, id, dto);
  }
}

@Module({ imports: [TypeOrmModule.forFeature([Exam, Question, Answer])], controllers: [ExamsController], providers: [ExamsService] })
export class ExamsModule {}
