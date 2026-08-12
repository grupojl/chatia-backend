// src/common/schemas/tenant-claims.schema.ts
//
// Contrato de custom claims que el sass-back de cada ecosistema debe emitir
// en el token Firebase al momento del login.
// Referencia: ADR-001 / ADR-003
import { z } from 'zod';

export const TenantClaimsSchema = z.object({
  organizationId:   z.string().min(1),
  organizationName: z.string().min(1),
  organizationSlug: z.string().optional(),

  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),

  // Permisos por servicio de plataforma.
  // Extensible: agregar claves por cada nuevo servicio (payments, analytics, etc.)
  permissions: z.object({
    chat: z.object({
      canRead:  z.boolean(),
      canWrite: z.boolean(),
    }).optional(),
  }).optional(),
});

export type TenantClaims = z.infer<typeof TenantClaimsSchema>;

export type TenantRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
