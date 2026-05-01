// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();
    const status   = exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const res      = exception.getResponse();

    const message =
      typeof res === 'string'
        ? res
        : (res as any)?.message ?? exception.message;

    const body = {
      success:   false,
      statusCode: status,
      message,
      path:      request.url,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} → ${status} — ${message}`);
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${status} — ${message}`);
    }

    response.status(status).json(body);
  }
}
