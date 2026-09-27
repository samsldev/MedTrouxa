import 'reflect-metadata';
import { validateEnv, appUrl, isProd } from './config/env';
validateEnv(); // antes de qualquer módulo ler variáveis de ambiente

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { seedDemoContent } from './database/demo';
import { seedIfEmpty } from './database/seed';
import { RedisService } from './redis/redis.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: isProd() ? ['error', 'warn', 'log'] : undefined,
  });
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1)); // IP real atrás do nginx/load balancer
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '200kb' });
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, // API só devolve JSON
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: isProd() ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  }));
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: isProd() ? [appUrl()] : [appUrl(), 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    maxAge: 600,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true, // rejeita campos extras (mass assignment)
    transform: true,
    disableErrorMessages: false,
  }));
  app.enableShutdownHooks();
  await seedIfEmpty(app);
  await seedDemoContent(app);
  await app.get(RedisService).invalidate('public:stats', 'public:testimonials');
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
  new Logger('Bootstrap').log(`API ouvindo na porta ${process.env.PORT ?? 3000} (${isProd() ? 'produção' : 'desenvolvimento'})`);
}
bootstrap();
