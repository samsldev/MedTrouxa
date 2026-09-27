import { Body, Controller, Delete, Get, Module, NotFoundException, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { InjectDataSource, InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { AdminOnly, Public } from '../common/auth';
import { DEMO_APPROVED_NAMES, DEMO_STATS, demoEnabled } from '../database/demo';
import { Testimonial } from '../database/entities';
import { RedisService } from '../redis/redis.module';

class TestimonialDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(160) school?: string;
  @IsString() @MaxLength(600) quote: string;
  @IsOptional() @IsString() @MaxLength(80) specialty?: string;
  @IsOptional() @IsString() @MaxLength(160) institutions?: string;
  @IsOptional() @IsString() @MaxLength(120) highlight?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) photoUrl?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) videoUrl?: string;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() approved?: boolean;
  @IsOptional() @IsBoolean() published?: boolean;
}
class UpdateTestimonialDto extends PartialType(TestimonialDto) {}

const CACHE_KEYS = ['public:stats', 'public:testimonials'];

@Controller('public')
class SocialController {
  constructor(
    @InjectRepository(Testimonial) private testimonials: Repository<Testimonial>,
    @InjectDataSource() private db: DataSource,
    private redis: RedisService,
  ) {}

  /** Números da plataforma para a prova social (reais; fictícios apenas no modo de teste) */
  @Public() @Get('stats')
  stats() {
    return this.redis.cached('public:stats', 600, async () => {
      if (demoEnabled()) return { ...DEMO_STATS, approvedNames: DEMO_APPROVED_NAMES };
      const [r] = await this.db.query(`SELECT
        (SELECT count(*) FROM questions)::int AS questions,
        (SELECT count(*) FROM flashcards)::int AS flashcards,
        (SELECT count(*) FROM users WHERE role = 'student')::int AS students,
        (SELECT count(*) FROM answers)::int AS answers`);
      const approved = await this.testimonials.find({ where: { approved: true, published: true, isDemo: false }, select: ['name'] });
      return { ...r, approved: approved.length, approvedNames: approved.map((a) => a.name) };
    });
  }

  @Public() @Get('testimonials')
  list() {
    return this.redis.cached('public:testimonials', 600, () => {
      const where = demoEnabled() ? { published: true } : { published: true, isDemo: false };
      return this.testimonials.find({ where, order: { featured: 'DESC', createdAt: 'DESC' } });
    });
  }

  @AdminOnly() @Get('testimonials/all')
  all() { return this.testimonials.find({ where: { isDemo: false }, order: { createdAt: 'DESC' } }); }

  @AdminOnly() @Post('testimonials')
  async create(@Body() dto: TestimonialDto) {
    const t = await this.testimonials.save(this.testimonials.create(dto));
    await this.redis.invalidate(...CACHE_KEYS);
    return t;
  }

  @AdminOnly() @Patch('testimonials/:id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTestimonialDto) {
    const t = await this.testimonials.findOneBy({ id });
    if (!t) throw new NotFoundException();
    Object.assign(t, dto);
    await this.testimonials.save(t);
    await this.redis.invalidate(...CACHE_KEYS);
    return t;
  }

  @AdminOnly() @Delete('testimonials/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.testimonials.delete(id);
    await this.redis.invalidate(...CACHE_KEYS);
    return { ok: true };
  }
}

@Module({ imports: [TypeOrmModule.forFeature([Testimonial])], controllers: [SocialController] })
export class SocialModule {}
