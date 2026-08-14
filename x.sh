cat > src/common/guards/roles.guard.ts << 'EOF'
// src/common/guards/roles.guard.ts
import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { TenantContext } from '../types/tenant-context';

const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const tenant: TenantContext | undefined = request.tenant;

    if (!tenant?.role) {
      throw new ForbiddenException('Sin contexto de tenant');
    }

    const tenantLevel  = ROLE_HIERARCHY[tenant.role.toUpperCase()] ?? -1;
    const minRequired  = Math.min(...required.map(r => ROLE_HIERARCHY[r.toUpperCase()] ?? 99));

    if (tenantLevel < minRequired) {
      throw new ForbiddenException(
        `Requiere rol: ${required.join(' o ')} — tenés: ${tenant.role}`,
      );
    }

    return true;
  }
}
EOF