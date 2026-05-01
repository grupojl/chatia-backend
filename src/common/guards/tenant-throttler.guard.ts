// src/common/guards/tenant-throttler.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  /**
   * Clave de throttling: proyecto (si existe) > organización > IP
   * Endpoints de IA usan x-project-id para limitar por proyecto independientemente.
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const projectId    = req.headers?.['x-project-id'] as string;
    const organizationId = req.headers?.['x-organization-id'] as string;

    if (projectId)    return `proj:${projectId}`;
    if (organizationId) return `org:${organizationId}`;

    return req.ip ?? req.connection?.remoteAddress ?? 'unknown';
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req  = context.switchToHttp().getRequest();
    const path: string = req.path ?? '';
    // Webhooks de Meta/TikTok son ráfagas cortas — sin rate limit
    if (path.includes('/webhooks/')) return true;
    return false;
  }
}
