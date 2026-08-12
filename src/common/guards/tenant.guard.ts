// src/common/guards/tenant.guard.ts
//
// ADR-001 Sprint 2 — TenantGuard reescrito como plataforma independiente.
//
// Flujo:
//   1. Extraer Bearer token
//   2. Verificar con Firebase Admin SDK → decodedToken
//   3. Extraer firebaseProjectId del token (campo 'aud')
//   4. Resolver Ecosystem en DB por firebaseProjectId
//   5. Validar custom claims con Zod (TenantClaimsSchema)
//   6. Verificar claims.organizationId === header x-organization-id
//   7. Verificar permissions.chat.canRead
//   8. Upsert pasivo de Organization + Agent
//   9. Poblar request.tenant con TenantContext completo
//
// Ya NO llama a DashboardAuthService ni a OrganizationsService.
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService }    from '@nestjs/config';
import { FirebaseService }  from '../../firebase/firebase.service';
import { EcosystemService } from '../../ecosystem/ecosystem.service';
import { PrismaService }    from '../../prisma/prisma.service';
import { TenantClaimsSchema } from '../schemas/tenant-claims.schema';
import type { TenantContext }  from '../types/tenant-context';

const PRODUCT_KEY = 'chat';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    private readonly firebase:   FirebaseService,
    private readonly ecosystem:  EcosystemService,
    private readonly prisma:     PrismaService,
    private readonly config:     ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request   = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;
    const orgHeader  = request.headers['x-organization-id'] as string | undefined;
    const isDev      = this.config.get('NODE_ENV') !== 'production';

    // ── Modo desarrollo: Firebase no configurado ──────────────────────────────
    if (!this.firebase.isInitialized) {
      if (!isDev) {
        throw new UnauthorizedException('Firebase no configurado en producción');
      }
      if (!orgHeader) {
        throw new UnauthorizedException('x-organization-id requerido (modo dev)');
      }
      this.logger.warn(`[DEV] Sin Firebase — org: ${orgHeader}`);
      request.tenant = {
        ecosystemId:      'dev',
        organizationId:   orgHeader,
        organizationName: 'Dev Organization',
        firebaseUid:      'dev-uid',
        email:            'dev@localhost',
        name:             'Dev User',
        role:             'ADMIN',
        canRead:          true,
        canWrite:         true,
      } satisfies TenantContext;
      return true;
    }

    // ── Sin Bearer token (fallback dev) ───────────────────────────────────────
    if (!authHeader?.startsWith('Bearer ')) {
      if (isDev && orgHeader) {
        this.logger.warn('[DEV] Sin Bearer token — usando x-organization-id');
        request.tenant = {
          ecosystemId:      'dev',
          organizationId:   orgHeader,
          organizationName: 'Dev Organization',
          firebaseUid:      'dev-uid',
          email:            'dev@localhost',
          name:             'Dev User',
          role:             'ADMIN',
          canRead:          true,
          canWrite:         true,
        } satisfies TenantContext;
        return true;
      }
      throw new UnauthorizedException('Authorization Bearer requerido');
    }

    const token = authHeader.slice(7);

    // ── 1. Verificar token Firebase ───────────────────────────────────────────
    let decoded: Awaited<ReturnType<typeof this.firebase.verifyIdToken>>;
    try {
      decoded = await this.firebase.verifyIdToken(token);
    } catch {
      throw new UnauthorizedException('Token Firebase inválido o expirado');
    }

    // ── 2. Resolver Ecosystem por firebaseProjectId ───────────────────────────
    // El campo 'aud' del token es el firebaseProjectId del ecosistema emisor
    const firebaseProjectId = Array.isArray(decoded.aud)
      ? decoded.aud[0]
      : decoded.aud;

    const ecosystemRecord = await this.ecosystem.resolveByFirebaseProjectId(firebaseProjectId);

    if (!ecosystemRecord) {
      this.logger.warn(`Ecosistema no registrado: ${firebaseProjectId}`);
      throw new ForbiddenException(
        `Ecosistema no autorizado. Registralo en POST /api/v1/ecosystems.`,
      );
    }

    if (!ecosystemRecord.isActive) {
      throw new ForbiddenException('Ecosistema desactivado');
    }

    // ── 3. Validar custom claims con Zod ──────────────────────────────────────
    const claimsResult = TenantClaimsSchema.safeParse(decoded);

    if (!claimsResult.success) {
      this.logger.warn(
        `Claims inválidos para uid ${decoded.uid}: ${claimsResult.error.message}`,
      );
      throw new ForbiddenException(
        'Token sin claims requeridos. El sass-back debe emitir organizationId, role y permissions.',
      );
    }

    const claims = claimsResult.data;

    // ── 4. Verificar organizationId del header ────────────────────────────────
    if (!orgHeader) {
      throw new UnauthorizedException('Header x-organization-id requerido');
    }

    if (claims.organizationId !== orgHeader) {
      throw new ForbiddenException(
        `organizationId del token (${claims.organizationId}) no coincide con el header (${orgHeader})`,
      );
    }

    // ── 5. Verificar permissions.chat.canRead ─────────────────────────────────
    const chatPerms = claims.permissions?.[PRODUCT_KEY];
    if (!chatPerms?.canRead) {
      throw new ForbiddenException(
        `Sin acceso al módulo "${PRODUCT_KEY}" en esta organización`,
      );
    }

    // ── 6. Upsert pasivo de Organization ──────────────────────────────────────
    await this.ecosystem.ensureOrganization(
      ecosystemRecord.id,
      claims.organizationId,
      claims.organizationName,
      claims.organizationSlug,
    );

    // ── 7. Upsert pasivo de Agent ─────────────────────────────────────────────
    const agent = await this.prisma.agent.upsert({
      where:  { firebaseUid: decoded.uid },
      update: {
        name:  decoded.name  ?? decoded.email ?? decoded.uid,
        email: decoded.email ?? `${decoded.uid}@unknown`,
        role:  claims.role,
      },
      create: {
        firebaseUid:    decoded.uid,
        organizationId: claims.organizationId,
        name:           decoded.name  ?? decoded.email ?? decoded.uid,
        email:          decoded.email ?? `${decoded.uid}@unknown`,
        role:           claims.role,
      },
    });

    // ── 8. Poblar request.tenant ──────────────────────────────────────────────
    request.tenant = {
      ecosystemId:      ecosystemRecord.id,
      organizationId:   claims.organizationId,
      organizationName: claims.organizationName,
      firebaseUid:      decoded.uid,
      email:            decoded.email ?? '',
      name:             decoded.name  ?? decoded.email ?? decoded.uid,
      role:             claims.role,
      canRead:          chatPerms.canRead,
      canWrite:         chatPerms.canWrite ?? false,
      agentId:          agent.id,
    } satisfies TenantContext;

    return true;
  }
}
