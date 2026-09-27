import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsInt, IsString } from 'class-validator';
import { Repository } from 'typeorm';
import { AdminOnly } from '../common/auth';
import { Subject, Topic } from '../database/entities';
import { RedisService } from '../redis/redis.module';

class SubjectDto { @IsString() name: string }
class TopicDto { @IsString() name: string; @IsInt() subjectId: number }

@Controller('subjects')
class SubjectsController {
  constructor(
    @InjectRepository(Subject) private subjects: Repository<Subject>,
    @InjectRepository(Topic) private topics: Repository<Topic>,
    private redis: RedisService,
  ) {}

  @Get()
  tree() {
    return this.redis.cached('subjects:tree', 3600, () =>
      this.subjects.find({ relations: { topics: true }, order: { name: 'ASC', topics: { name: 'ASC' } } }));
  }

  @AdminOnly() @Post()
  async create(@Body() dto: SubjectDto) {
    const s = await this.subjects.save(this.subjects.create(dto));
    await this.redis.invalidate('subjects:tree');
    return s;
  }

  @AdminOnly() @Post('topics')
  async createTopic(@Body() dto: TopicDto) {
    const t = await this.topics.save(this.topics.create(dto));
    await this.redis.invalidate('subjects:tree');
    return t;
  }
}

@Module({ imports: [TypeOrmModule.forFeature([Subject, Topic])], controllers: [SubjectsController] })
export class SubjectsModule {}
