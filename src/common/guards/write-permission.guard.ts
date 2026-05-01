// src/common/guards/write-permission.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { TenantContext } from '../types/tenant-context';

/**
 * Guard liviano que verifica tenant.canWrite.
 * Siempre se usa DESPUÉS de TenantGuard (que ya pobló request.tenant).
 *
 * Uso: @UseGuards(TenantGuard, WritePermissionGuard)
 */
@Injectable()
export class WritePermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenant: TenantContext | undefined = request.tenant;

    if (!tenant) {
      throw new ForbiddenException('Sin contexto de tenant');
    }

    if (!tenant.canWrite) {
      throw new ForbiddenException(
        'Tu cuenta no tiene permisos de escritura en el sistema "chat". ' +
        'Contactá al administrador del owner-dashboard para solicitar acceso.',
      );
    }

    return true;
  }
}
