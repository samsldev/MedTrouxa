import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
  });

  /** Cache-aside: devolve do Redis ou calcula e guarda por `ttl` segundos. Falha do Redis não derruba a API. */
  async cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.client.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch { /* redis indisponível */ }
    const value = await fn();
    this.client.set(key, JSON.stringify(value), 'EX', ttl).catch(() => undefined);
    return value;
  }

  async invalidate(...keys: string[]) {
    if (keys.length) await this.client.del(...keys).catch(() => undefined);
  }

  /** Ranking global por XP (sorted set) */
  async addXp(userId: string, amount: number) {
    await this.client.zincrby('ranking:xp', amount, userId).catch(() => undefined);
    const day = new Date().toISOString().slice(0, 10);
    await this.client.sadd(`streak:${userId}`, day).catch(() => undefined);
  }

  async topRanking(n: number): Promise<{ userId: string; xp: number }[]> {
    const raw = await this.client.zrevrange('ranking:xp', 0, n - 1, 'WITHSCORES').catch(() => [] as string[]);
    const out: { userId: string; xp: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) out.push({ userId: raw[i], xp: Number(raw[i + 1]) });
    return out;
  }

  /** Dias consecutivos (até hoje) com alguma atividade */
  async streak(userId: string): Promise<number> {
    const days = new Set(await this.client.smembers(`streak:${userId}`).catch(() => [] as string[]));
    let n = 0;
    const d = new Date();
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
    return n;
  }

  onModuleDestroy() { this.client.disconnect(); }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
