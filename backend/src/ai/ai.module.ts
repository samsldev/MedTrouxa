import {
  Body, Controller, ForbiddenException, HttpException, HttpStatus, Injectable, Module, NotFoundException, Param, ParseIntPipe, Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Repository } from 'typeorm';
import { CurrentUser, JwtUser } from '../common/auth';
import { Question } from '../database/entities';
import { BillingModule, BillingService } from '../billing/billing.module';
import { RedisService } from '../redis/redis.module';

const SYSTEM = `Você é a Coruja, tutora de medicina do MedTrouxa. Responda em português do Brasil,
de forma didática e objetiva, voltada a estudantes de medicina e candidatos ao ENAMED/residência.
Use tópicos curtos, destaque "pegadinhas" de prova e cite condutas conforme diretrizes brasileiras quando pertinente.
Nunca dê orientação médica para casos reais de pacientes; é conteúdo educacional.`;

class MsgDto { @IsIn(['user', 'assistant']) role: 'user' | 'assistant'; @IsString() @MaxLength(4000) content: string }
class ChatDto { @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => MsgDto) messages: MsgDto[] }
class GenerateDto { @IsString() @MaxLength(8000) text: string }

@Injectable()
class AiService {
  constructor(private redis: RedisService, private billing: BillingService) {}

  private async rateLimit(user: JwtUser) {
    const { aiPerHour } = await this.billing.limits(user);
    if (aiPerHour === 0) throw new ForbiddenException({ code: 'PLAN_REQUIRED', feature: 'ai', message: 'A Coruja IA faz parte dos planos pagos.' });
    const key = `ai:rl:${user.sub}:${new Date().toISOString().slice(0, 13)}`;
    const n = await this.redis.client.incr(key).catch(() => 0);
    if (n === 1) await this.redis.client.expire(key, 3600).catch(() => undefined);
    if (n > aiPerHour) throw new HttpException(`Limite de ${aiPerHour} mensagens por hora do seu plano atingido`, HttpStatus.TOO_MANY_REQUESTS);
  }

  async complete(user: JwtUser, messages: { role: 'user' | 'assistant'; content: string }[], maxTokens = 1500) {
    await this.rateLimit(user); // plano e cota primeiro
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('A Coruja está temporariamente indisponível');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.AI_MODEL ?? 'claude-sonnet-5', max_tokens: maxTokens, system: SYSTEM, messages }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new ServiceUnavailableException(`Falha na IA (${res.status})`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  }
}

@Controller('ai')
class AiController {
  constructor(private ai: AiService, @InjectRepository(Question) private questions: Repository<Question>) {}

  @Post('chat')
  async chat(@CurrentUser() u: JwtUser, @Body() dto: ChatDto) {
    return { reply: await this.ai.complete(u, dto.messages) };
  }

  /** Explica uma questão (alternativa correta e por que as outras estão erradas) */
  @Post('explain/:questionId')
  async explain(@CurrentUser() u: JwtUser, @Param('questionId', ParseIntPipe) id: number) {
    const q = await this.questions.createQueryBuilder('q').addSelect(['q.correctKey', 'q.commentary']).where('q.id = :id', { id }).getOne();
    if (!q) throw new NotFoundException();
    const alts = q.alternatives.map((a) => `${a.key}) ${a.text}`).join('\n');
    const prompt = `Explique esta questão. Gabarito: ${q.correctKey}.\n\n${q.statement}\n\n${alts}\n\nComentário oficial: ${q.commentary}\n\nExplique por que a correta está certa e por que cada outra está errada, e termine com um "resumo de bolso".`;
    return { reply: await this.ai.complete(u, [{ role: 'user', content: prompt }]) };
  }

  /** Gera flashcards a partir de um texto/resumo */
  @Post('flashcards')
  async flashcards(@CurrentUser() u: JwtUser, @Body() dto: GenerateDto) {
    const prompt = `Crie de 5 a 15 flashcards (pergunta/resposta curtas) a partir do texto abaixo. Responda APENAS com JSON no formato [{"front":"...","back":"..."}].\n\n${dto.text}`;
    const raw = await this.ai.complete(u, [{ role: 'user', content: prompt }], 2000);
    const match = raw.match(/\[[\s\S]*\]/);
    try {
      const cards = JSON.parse(match?.[0] ?? '[]') as { front: string; back: string }[];
      return { cards: cards.filter((c) => c.front && c.back) };
    } catch {
      return { cards: [] };
    }
  }
}

@Module({ imports: [TypeOrmModule.forFeature([Question]), BillingModule], controllers: [AiController], providers: [AiService] })
export class AiModule {}
