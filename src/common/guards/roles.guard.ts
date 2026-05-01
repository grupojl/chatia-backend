// src/common/guards/roles.guard.ts
import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { TenantContext } from '../types/tenant-context';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no hay @Roles() en el handler, permitir siempre
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const tenant: TenantContext | undefined = request.tenant;

    if (!tenant?.roles?.length) {
      throw new ForbiddenException('Sin roles asignados');
    }

    const hasRole = required.some((r) => tenant.roles.includes(r));
    if (!hasRole) {
      throw new ForbiddenException(
        `Requiere rol: ${required.join(' o ')} — tenés: ${tenant.roles.join(', ')}`,
      );
    }

    return true;
  }
}
