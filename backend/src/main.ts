import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { seedDemoContent } from './database/demo';
import { seedIfEmpty } from './database/seed';
import { RedisService } from './redis/redis.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',') });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await seedIfEmpty(app);
  await seedDemoContent(app);
  await app.get(RedisService).invalidate('public:stats', 'public:testimonials');
  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();
