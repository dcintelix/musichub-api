import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const details = exception instanceof Error ? exception.stack ?? exception.message : String(exception);
      this.logger.error(`${request.method} ${request.url} failed: ${details}`);
    }

    const message =
      exception instanceof HttpException
        ? exception.getResponse() instanceof Object
          ? (exception.getResponse() as any).message || exception.message
          : exception.message
        : 'Internal server error';

    const payload: Record<string, unknown> = {
      success: false,
      message,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      payload.error = 'Internal server error';
    } else {
      payload.error = HttpStatus[status] || 'Error';
    }

    response.status(status).json(payload);
  }
}
