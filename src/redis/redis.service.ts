import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: RedisClientType;

  constructor(private readonly configService: ConfigService) {}

  get isConfigured(): boolean {
    return this.client !== undefined;
  }

  get isConnected(): boolean {
    return this.client?.isReady ?? false;
  }

  async checkConnection(): Promise<boolean> {
    if (!this.client?.isReady) {
      return false;
    }

    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      this.logger.warn('Redis health check failed');
      return false;
    }
  }

  async onModuleInit(): Promise<void> {
    const url = this.configService.get<string>('REDIS_URL')?.trim();
    if (!url) {
      this.logger.warn('Redis is not configured; skipping connection');
      return;
    }

    this.client = createClient({ url });
    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis client error: ${error.message}`);
    });

    await this.client.connect();
    this.logger.log('Redis connection established');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }
}
