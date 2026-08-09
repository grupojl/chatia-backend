// src/common/services/cache.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private client: RedisClientType | null = null;
  private connected = false;

  private get redisEnabled(): boolean {
    return process.env['REDIS_ENABLED'] === 'true';
  }

  async onModuleInit() {
    // Sin este guard, el cliente intenta conectar aunque REDIS_ENABLED=false,
    // generando ECONNRESET en loop cada 30s e impidiendo el sleep en Railway.
    if (!this.redisEnabled) {
      this.logger.log('CacheService: Redis deshabilitado (REDIS_ENABLED=false) — modo no-op');
      return;
    }

    try {
      this.client = createClient({
        url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
        socket: {
          // Corta después de 10 reintentos en lugar de reintentar eternamente
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              this.logger.warn('CacheService: Redis sin respuesta tras 10 reintentos — modo no-op');
              return new Error('Redis: máximo de reintentos alcanzado');
            }
            return Math.min(retries * 500, 5000);
          },
        },
      }) as RedisClientType;

      this.client.on('error', (err) => this.logger.warn(`Redis error: ${err}`));
      await this.client.connect();
      this.connected = true;
      this.logger.log('CacheService: Redis conectado');
    } catch (err) {
      this.logger.warn(`CacheService: Redis no disponible — modo no-op: ${err}`);
    }
  }

  async onModuleDestroy() {
    if (this.client && this.connected) await this.client.disconnect();
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected || !this.client) return null;
    try {
      const val = await this.client.get(key);
      return val ? (JSON.parse(val) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    if (!this.connected || !this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (err) {
      this.logger.warn(`Cache set falló: ${err}`);
    }
  }

  async del(pattern: string): Promise<void> {
    if (!this.connected || !this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length) await this.client.del(keys);
    } catch (err) {
      this.logger.warn(`Cache del falló: ${err}`);
    }
  }

  buildFaqKey(kbId: string, question: string): string {
    let hash = 0;
    for (let i = 0; i < question.length; i++) {
      hash = ((hash << 5) - hash + question.charCodeAt(i)) | 0;
    }
    return `faq:${kbId}:${Math.abs(hash)}`;
  }
}
