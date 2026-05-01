// src/health/health.controller.ts
import { Controller, Get, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { version } from '../../package.json';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Estado del sistema' })
  check() {
    return {
      status: 'ok',
      system: 'chat-ia',
      version,
      timestamp: new Date().toISOString(),
      environment: this.config.get('NODE_ENV'),
    };
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Verificar conectividad con owner-dashboard' })
  async checkDashboard() {
    const dashboardUrl = this.config.get<string>('DASHBOARD_URL');
    if (!dashboardUrl) {
      return { status: 'not_configured', dashboard: null };
    }

    try {
      const response = await fetch(`${dashboardUrl}/api/v1/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return {
        status: response.ok ? 'ok' : 'degraded',
        dashboard: dashboardUrl,
        dashboardStatus: response.status,
      };
    } catch (err) {
      this.logger.warn(`Dashboard no alcanzable: ${err}`);
      return {
        status: 'unreachable',
        dashboard: dashboardUrl,
        error: 'No se pudo conectar',
      };
    }
  }
}
