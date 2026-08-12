#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix build errors Sprint 1 / ADR-001
# Repo: chat-ia-lang (chat-ia-back)
#
# Errores que corrige:
#   1. roles.guard.ts       — tenant posiblemente undefined + roles → role
#   2. tenant.guard.ts      — roles[] → role en los 4 literales del objeto
#   3. agents.controller.ts — roles → role + ecosystemId en Organization.create
#   4. organizations.service.ts — ecosystemId en Organization.create/upsert
#   5. ecosystem.service.ts — config: Prisma.JsonObject cast
#
# USO:
#   cd <raíz de chat-ia-lang>
#   bash x.sh
# =============================================================================
set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
log()     { echo -e "${BLUE}[→]${NC} $1"; }
ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
err()     { echo -e "${RED}[✗]${NC} $1"; exit 1; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$ROOT/src/app.module.ts" ]] || err "Ejecutá desde la raíz de chat-ia-lang"

sed_inplace() {
  local expr="$1"; local file="$2"
  sed -i.sedbak "$expr" "$file" 2>/dev/null || sed -i "$expr" "$file"
  rm -f "${file}.sedbak"
}

write_file() {
  local rel="$1"; local full="$ROOT/$rel"
  mkdir -p "$(dirname "$full")"
  [[ -f "$full" ]] && cp "$full" "${full}.bak" && log "backup → ${rel}.bak"
  cat > "$full"
  ok "write → $rel"
}

# =============================================================================
# 1 — roles.guard.ts: tenant undefined + roles → role
# =============================================================================
section "1/4 — roles.guard.ts"

write_file "src/common/guards/roles.guard.ts" << 'EOF'
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

    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const tenant: TenantContext | undefined = request.tenant;

    if (!tenant?.role) {
      throw new ForbiddenException('Sin rol asignado');
    }

    const hasRole = required.includes(tenant.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Requiere rol: ${required.join(' o ')} — tenés: ${tenant.role}`,
      );
    }

    return true;
  }
}
EOF

# =============================================================================
# 2 — tenant.guard.ts: reemplazar roles[] por role en los objetos literales
# =============================================================================
section "2/4 — tenant.guard.ts"

TENANT_GUARD="$ROOT/src/common/guards/tenant.guard.ts"
[[ -f "$TENANT_GUARD" ]] || err "tenant.guard.ts no encontrado"

cp "$TENANT_GUARD" "${TENANT_GUARD}.bak"
log "backup → tenant.guard.ts.bak"

# roles: ['admin'] → role: 'ADMIN'
sed_inplace "s/roles: \['admin'\]/role: 'ADMIN'/g" "$TENANT_GUARD"

# roles: ['agent'] → role: 'MEMBER'
sed_inplace "s/roles: \['agent'\]/role: 'MEMBER'/g" "$TENANT_GUARD"

# roles, (variable sola en el objeto, viene del dashboard) → role: roles[0] ?? 'MEMBER'
# Este caso es la línea: roles, dentro del objeto TenantContext
sed_inplace "s/^      roles,$/      role: roles\[0\] ?? 'MEMBER',/" "$TENANT_GUARD"

# ecosystemId faltante en los objetos dev — agregar placeholder
# Los objetos TenantContext del modo dev no tienen ecosystemId todavía (se agrega en Sprint 2)
# Por ahora ponemos string vacío para que compile
sed_inplace "s/organizationId: orgHeader,/ecosystemId: 'dev',\n        organizationId: orgHeader,/g" "$TENANT_GUARD"

ok "patch → tenant.guard.ts"
warn "Revisar tenant.guard.ts — confirmar que los 4 objetos TenantContext tienen role y ecosystemId"

# =============================================================================
# 3 — agents.controller.ts: roles → role + ecosystemId en Organization.create
# =============================================================================
section "3/4 — agents.controller.ts"

AGENTS_CTRL="$ROOT/src/agents/agents.controller.ts"
[[ -f "$AGENTS_CTRL" ]] || { warn "agents.controller.ts no encontrado — saltando"; }

if [[ -f "$AGENTS_CTRL" ]]; then
  cp "$AGENTS_CTRL" "${AGENTS_CTRL}.bak"
  log "backup → agents.controller.ts.bak"

  # tenant.roles.includes('admin') → tenant.role === 'OWNER' || tenant.role === 'ADMIN'
  sed_inplace \
    "s/tenant\.roles\.includes('admin')/tenant.role === 'OWNER' || tenant.role === 'ADMIN'/g" \
    "$AGENTS_CTRL"

  # Organization.create sin ecosystemId — agregar ecosystemId: 'dev' como placeholder
  # La línea es: data: { id: randomUUID(), name: ..., slug: ..., isActive: true }
  sed_inplace \
    "s/data: { id: randomUUID(), name: \`Org de \${dto\.name}\`, slug: \`org-\${Date\.now()}\`, isActive: true }/data: { id: randomUUID(), ecosystemId: 'dev', name: \`Org de \${dto.name}\`, slug: \`org-\${Date.now()}\`, isActive: true }/g" \
    "$AGENTS_CTRL"

  ok "patch → agents.controller.ts"
  warn "ecosystemId: 'dev' es un placeholder — se reemplaza en Sprint 2 cuando el TenantGuard lo provea"
fi

# =============================================================================
# 4 — organizations.service.ts: ecosystemId en create/upsert
# =============================================================================
section "4/4 — organizations.service.ts + ecosystem.service.ts"

ORGS_SVC="$ROOT/src/organizations/organizations.service.ts"

if [[ -f "$ORGS_SVC" ]]; then
  cp "$ORGS_SVC" "${ORGS_SVC}.bak"
  log "backup → organizations.service.ts.bak"

  # create: { id, name, slug, isActive: true } → agregar ecosystemId: 'dev'
  sed_inplace \
    "s/create: { id, name, slug, isActive: true }/create: { id, ecosystemId: 'dev', name, slug, isActive: true }/g" \
    "$ORGS_SVC"

  # Variante sin slug
  sed_inplace \
    "s/create: { id, name, isActive: true }/create: { id, ecosystemId: 'dev', name, isActive: true }/g" \
    "$ORGS_SVC"

  ok "patch → organizations.service.ts"
  warn "ecosystemId: 'dev' es un placeholder — Sprint 2 lo reemplaza con el id real del Ecosystem"
else
  warn "organizations.service.ts no encontrado — verificar manualmente"
fi

# =============================================================================
# 5 — ecosystem.service.ts: config cast a Prisma.InputJsonValue
# =============================================================================
ECO_SVC="$ROOT/src/ecosystem/ecosystem.service.ts"

if [[ -f "$ECO_SVC" ]]; then
  cp "$ECO_SVC" "${ECO_SVC}.bak"

  # Agregar import de Prisma si no existe
  if ! grep -q "import { Prisma }" "$ECO_SVC"; then
    sed_inplace \
      "s|import { PrismaService }|import { Prisma } from '@prisma/client';\nimport { PrismaService }|" \
      "$ECO_SVC"
  fi

  # config: dto.config ?? {} → config: (dto.config ?? {}) as Prisma.InputJsonValue
  sed_inplace \
    "s/config: dto\.config ?? {}/config: (dto.config ?? {}) as Prisma.InputJsonValue/g" \
    "$ECO_SVC"

  # config (en update) → config: config as Prisma.InputJsonValue
  sed_inplace \
    "s/data: { config }/data: { config: config as Prisma.InputJsonValue }/g" \
    "$ECO_SVC"

  ok "patch → ecosystem.service.ts"
fi

# =============================================================================
section "Fixes completados"

echo ""
echo "  Próximo paso:"
echo "    pnpm build"
echo ""
echo "  Si quedan errores en tenant.guard.ts, revisá manualmente:"
echo "    - Que todos los objetos TenantContext tengan 'role' (no 'roles')"
echo "    - Que todos los objetos TenantContext tengan 'ecosystemId'"
echo "    grep -n 'roles' src/common/guards/tenant.guard.ts"