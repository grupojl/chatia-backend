#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix: excluir _deprecated/ del build TypeScript
# Repo: chat-ia-lang
# =============================================================================
set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
log() { echo -e "${BLUE}[→]${NC} $1"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

sed_inplace() {
  local expr="$1"; local file="$2"
  sed -i.sedbak "$expr" "$file" 2>/dev/null || sed -i "$expr" "$file"
  rm -f "${file}.sedbak"
}

# Opción A: eliminar directamente el archivo deprecated (es lo más limpio)
DEPRECATED="$ROOT/src/common/services/_deprecated/dashboard-auth.service.ts"

if [[ -f "$DEPRECATED" ]]; then
  rm "$DEPRECATED"
  rmdir "$ROOT/src/common/services/_deprecated" 2>/dev/null || true
  ok "dashboard-auth.service.ts eliminado"
fi

# Opción B (por si acaso): agregar exclude en tsconfig.build.json
TSCONFIG_BUILD="$ROOT/tsconfig.build.json"

if [[ -f "$TSCONFIG_BUILD" ]]; then
  log "Verificando tsconfig.build.json..."

  if ! grep -q '_deprecated' "$TSCONFIG_BUILD"; then
    # Agregar **/_deprecated/** al array exclude
    sed_inplace \
      's|"node_modules"|"node_modules",\n    "**/_deprecated/**"|' \
      "$TSCONFIG_BUILD"
    ok "tsconfig.build.json: _deprecated excluido"
  else
    log "_deprecated ya está excluido en tsconfig.build.json"
  fi
fi

echo ""
echo "  Próximo paso: pnpm build"