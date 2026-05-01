#!/usr/bin/env bash
# =============================================================================
# fix-ts-errors.sh
# Corrige los 2 errores TS — solo bash puro, sin Python ni Node
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; RESET='\033[0m'

log()    { echo -e "${GREEN}✔${RESET}  $*"; }
warn()   { echo -e "${YELLOW}⚠${RESET}  $*"; }
info()   { echo -e "${CYAN}→${RESET}  $*"; }
header() { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}"; }

[[ -f "package.json" ]] || { echo "Ejecutar desde la raíz del proyecto"; exit 1; }

# =============================================================================
# FIX 1 — agents.controller.ts
# Agregar import { randomUUID } from 'crypto'
# Reemplazar el data del Organization.create para incluir id requerido
# =============================================================================
header "FIX 1 — agents.controller.ts: Organization.create necesita 'id'"

AGENTS_FILE="src/agents/agents.controller.ts"

if [[ ! -f "$AGENTS_FILE" ]]; then
  warn "$AGENTS_FILE no encontrado — saltando"
else
  cp "$AGENTS_FILE" "${AGENTS_FILE}.bak"

  # Paso 1: agregar import de randomUUID si no está
  if ! grep -q "randomUUID" "$AGENTS_FILE"; then
    sed -i "1s|^|import { randomUUID } from 'crypto';\n|" "$AGENTS_FILE"
    log "import randomUUID agregado"
  else
    log "randomUUID ya estaba importado"
  fi

  # Paso 2: reemplazar el create de Organization
  if grep -q "data: { name: \`Org de \${dto.name}\` }" "$AGENTS_FILE"; then
    sed -i "s|data: { name: \`Org de \${dto.name}\` }|data: { id: randomUUID(), name: \`Org de \${dto.name}\`, slug: \`org-\${Date.now()}\`, isActive: true }|g" "$AGENTS_FILE"
    log "Organization.create actualizado con id + slug + isActive"
  else
    warn "Patrón exacto no encontrado — revisá manualmente la línea ~69 de $AGENTS_FILE"
    warn "Debe quedar: data: { id: randomUUID(), name: \`Org de \${dto.name}\`, slug: \`org-\${Date.now()}\`, isActive: true }"
  fi
fi

# =============================================================================
# FIX 2 — tenant.guard.ts: eliminar import dinámico con ruta incorrecta
# =============================================================================
header "FIX 2 — tenant.guard.ts: eliminar import dinámico inútil"

GUARD_FILE="src/common/guards/tenant.guard.ts"

if [[ ! -f "$GUARD_FILE" ]]; then
  warn "$GUARD_FILE no encontrado — saltando"
else
  if grep -q "await import('../../prisma/prisma.service')" "$GUARD_FILE"; then
    cp "$GUARD_FILE" "${GUARD_FILE}.bak"

    # Eliminar la línea del import dinámico
    sed -i "/await import('\.\.\/\.\.\/prisma\/prisma\.service')/d" "$GUARD_FILE"

    # Eliminar el comentario que la precede
    sed -i "/Import din.*mico para evitar circular dependency/d" "$GUARD_FILE"

    log "$GUARD_FILE corregido"
  else
    log "$GUARD_FILE — import dinámico no encontrado (ya corregido)"
  fi
fi

# =============================================================================
# VERIFICACIÓN
# =============================================================================
header "Verificación de tipos TypeScript"

info "Corriendo tsc --noEmit..."
if pnpm exec tsc --noEmit 2>&1; then
  echo ""
  log "¡Sin errores de TypeScript! ✓"
else
  echo ""
  warn "Todavía hay errores — revisá la salida arriba"
fi