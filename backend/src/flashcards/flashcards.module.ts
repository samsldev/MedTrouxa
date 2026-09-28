import {
  Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseIntPipe, Post,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { CurrentUser, JwtUser } from '../common/auth';
import { CardReview, Deck, Flashcard } from '../database/entities';
import { RedisService } from '../redis/redis.module';
import { sm2 } from './sm2';

class DeckDto { @IsString() @Length(1, 120) name: string; @IsOptional() @IsString() @MaxLength(1000) description?: string; @IsOptional() @IsInt() topicId?: number }
class CardDto { @IsString() @Length(1, 2000) front: string; @IsString() @Length(1, 4000) back: string }
class ReviewDto { @IsInt() @Min(0) @Max(5) grade: number }

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectRepository(Deck) private decks: Repository<Deck>,
    @InjectRepository(Flashcard) private cards: Repository<Flashcard>,
    @InjectRepository(CardReview) private reviews: Repository<CardReview>,
    private redis: RedisService,
  ) {}

  async listDecks(userId: string) {
    const rows = await this.decks.createQueryBuilder('d')
      .leftJoinAndSelect('d.topic', 't')
      .loadRelationCountAndMap('d.cardCount', 'd.cards')
      .where('d.ownerId IS NULL OR d.ownerId = :userId', { userId })
      .orderBy('d.name').getMany();
    const due = await this.reviews.manager.query(
      `SELECT c."deckId" AS "deckId", count(*)::int AS due
         FROM flashcards c LEFT JOIN card_reviews r ON r."cardId" = c.id AND r."userId" = $1
        WHERE r.id IS NULL OR r."dueAt" <= now() GROUP BY c."deckId"`, [userId]) as { deckId: number; due: number }[];
    const dueMap = new Map(due.map((d) => [d.deckId, d.due]));
    return rows.map((d) => ({ ...d, due: dueMap.get(d.id) ?? 0 }));
  }

  private async deckFor(userId: string, deckId: number, write = false) {
    const deck = await this.decks.findOneBy({ id: deckId });
    if (!deck) throw new NotFoundException();
    if (deck.ownerId && deck.ownerId !== userId) throw new ForbiddenException();
    if (write && deck.ownerId !== userId) throw new ForbiddenException('Baralhos públicos são somente leitura');
    return deck;
  }

  async deck(userId: string, deckId: number) {
    const deck = await this.deckFor(userId, deckId);
    return { ...deck, cards: await this.cards.find({ where: { deckId }, order: { id: 'ASC' } }) };
  }

  /** Cards novos ou vencidos, até 20 por sessão */
  async due(userId: string, deckId: number) {
    await this.deckFor(userId, deckId);
    return this.cards.manager.query(
      `SELECT c.id, c.front, c.back, r."dueAt", r.repetitions
         FROM flashcards c LEFT JOIN card_reviews r ON r."cardId" = c.id AND r."userId" = $1
        WHERE c."deckId" = $2 AND (r.id IS NULL OR r."dueAt" <= now())
        ORDER BY r."dueAt" NULLS LAST, c.id LIMIT 20`, [userId, deckId]);
  }

  async review(userId: string, cardId: number, grade: number) {
    const card = await this.cards.findOneBy({ id: cardId });
    if (!card) throw new NotFoundException();
    await this.deckFor(userId, card.deckId); // controle de acesso: não revisa cards de baralhos privados de terceiros
    const existing = await this.reviews.findOneBy({ userId, cardId });
    const wasDue = !existing || existing.dueAt <= new Date();
    const next = sm2(existing ?? { ease: 2.5, interval: 0, repetitions: 0 }, grade);
    await this.reviews.upsert({ userId, cardId, ...next }, ['userId', 'cardId']);
    // XP só para revisões que estavam pendentes (evita farm revisando o mesmo card)
    if (wasDue) await this.redis.addXp(userId, 2);
    await this.redis.invalidate(`stats:${userId}`);
    return next;
  }

  async createDeck(userId: string, dto: DeckDto) {
    if ((await this.decks.countBy({ ownerId: userId })) >= 200) throw new ForbiddenException('Limite de 200 baralhos');
    return this.decks.save(this.decks.create({ ...dto, ownerId: userId }));
  }

  async addCard(userId: string, deckId: number, dto: CardDto) {
    await this.deckFor(userId, deckId, true);
    if ((await this.cards.countBy({ deckId })) >= 5000) throw new ForbiddenException('Limite de 5.000 cards por baralho');
    return this.cards.save(this.cards.create({ ...dto, deckId }));
  }

  /** Apaga um baralho próprio com seus cards e o histórico de revisão (card_reviews não tem FK). */
  async deleteDeck(userId: string, deckId: number) {
    await this.deckFor(userId, deckId, true);
    await this.decks.manager.transaction(async (m) => {
      await m.query(`DELETE FROM card_reviews WHERE "cardId" IN (SELECT id FROM flashcards WHERE "deckId" = $1)`, [deckId]);
      await m.delete(Flashcard, { deckId });
      await m.delete(Deck, { id: deckId });
    });
    await this.redis.invalidate(`stats:${userId}`);
  }

  async deleteCard(userId: string, cardId: number) {
    const card = await this.cards.findOneBy({ id: cardId });
    if (!card) throw new NotFoundException();
    await this.deckFor(userId, card.deckId, true);
    await this.cards.manager.transaction(async (m) => {
      await m.delete(CardReview, { cardId });
      await m.delete(Flashcard, { id: cardId });
    });
    await this.redis.invalidate(`stats:${userId}`);
  }
}

@Controller('flashcards')
class FlashcardsController {
  constructor(private svc: FlashcardsService) {}
  @Get('decks') list(@CurrentUser() u: JwtUser) { return this.svc.listDecks(u.sub); }
  @Post('decks') create(@CurrentUser() u: JwtUser, @Body() dto: DeckDto) { return this.svc.createDeck(u.sub, dto); }
  @Get('decks/:id') deck(@CurrentUser() u: JwtUser, @Param('id', ParseIntPipe) id: number) { return this.svc.deck(u.sub, id); }
  @Get('decks/:id/due') due(@CurrentUser() u: JwtUser, @Param('id', ParseIntPipe) id: number) { return this.svc.due(u.sub, id); }
  @Post('decks/:id/cards') add(@CurrentUser() u: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CardDto) {
    return this.svc.addCard(u.sub, id, dto);
  }
  @Delete('decks/:id') @HttpCode(204) removeDeck(@CurrentUser() u: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteDeck(u.sub, id);
  }
  @Delete('cards/:id') @HttpCode(204) removeCard(@CurrentUser() u: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteCard(u.sub, id);
  }
  @Post('cards/:id/review') review(@CurrentUser() u: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReviewDto) {
    return this.svc.review(u.sub, id, dto.grade);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Deck, Flashcard, CardReview])],
  controllers: [FlashcardsController],
  providers: [FlashcardsService],
})
export class FlashcardsModule {}
