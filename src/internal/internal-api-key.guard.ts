// src/internal/internal-api-key.guard.ts
//
// Guard que protege /api/v1/internal/* — solo servicios internos del ecosistema.
// Valida el header x-api-key contra CHAT_INTERNAL_API_KEY en .env.
//
// No usa Firebase ni TenantGuard — es una clave compartida entre microservicios.
// Si en el futuro necesitás claves por servicio, reemplazá este guard sin
// tocar los controllers.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req     = ctx.switchToHttp().getRequest();
    const apiKey  = req.headers['x-api-key'] as string | undefined;
    const valid   = this.config.get<string>('CHAT_INTERNAL_API_KEY');

    if (!valid) {
      this.logger.error('CHAT_INTERNAL_API_KEY no configurada en .env');
      throw new ForbiddenException('Servicio no configurado para acceso interno');
    }

    if (!apiKey || apiKey !== valid) {
      this.logger.warn(`x-api-key inválida desde ${req.ip}`);
      throw new ForbiddenException('x-api-key inválida o ausente');
    }

    return true;
  }
}
