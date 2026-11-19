import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get(['', 'ready'])
  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        'Database readiness check failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException({
        ok: false,
        message: 'Database is unavailable',
        database: { connected: false },
      });
    }

    const redis = {
      configured: this.redis.isConfigured,
      connected: await this.redis.checkConnection(),
    };

    if (redis.configured && !redis.connected) {
      throw new ServiceUnavailableException({
        ok: false,
        message: 'Redis is unavailable',
        redis,
      });
    }

    return {
      ok: true,
      message: 'Application and database are healthy',
      database: { connected: true },
      redis,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  getLiveness() {
    return {
      ok: true,
      message: 'Application is live',
      timestamp: new Date().toISOString(),
    };
  }
}
