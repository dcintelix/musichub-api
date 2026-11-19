import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cors from 'cors';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const requestLogger = new Logger('HTTP');
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  app.use((req, res, next) => {
    const startedAt = Date.now();
    const requestId = randomUUID();
    res.setHeader('X-Request-ID', requestId);
    res.once('finish', () => {
      requestLogger.log(
        `[${requestId}] ${req.method} ${req.path} ${res.statusCode} - ${Date.now() - startedAt}ms`,
      );
    });
    res.once('close', () => {
      if (!res.writableFinished) {
        requestLogger.warn(`[${requestId}] ${req.method} ${req.path} connection closed before response finished`);
      }
    });
    next();
  });

  app.setGlobalPrefix('api/v1');
  app.getHttpAdapter().get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: ' API is running',
      docs: '/docs',
      api: '/api/v1',
    });
  });
  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const config = new DocumentBuilder()
    .setTitle(' API')
    .setDescription('Backend API for ')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();
  await app.listen(port);
  new Logger('Bootstrap').log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
