#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix chat-ia-back: CommonModule exporta EcosystemModule
# Repo: chat-ia-lang (raíz del repo)
#
# Problema:
#   TenantGuard necesita EcosystemService pero CommonModule lo importa
#   sin exportarlo. Todos los módulos que usan @UseGuards(TenantGuard)
#   fallan porque EcosystemService no está disponible en su contexto.
#
# Solución:
#   CommonModule es @Global() — si exporta EcosystemModule, EcosystemService
#   queda disponible en TODOS los módulos sin tocar nada más.
#
# USO (desde raíz de chat-ia-lang):
#   bash x.sh
# =============================================================================
set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ -f "$ROOT/src/app.module.ts" ]]                || { echo "Ejecutá desde la raíz de chat-ia-lang"; exit 1; }
[[ -f "$ROOT/src/common/common.module.ts" ]]      || { echo "No encontré common.module.ts"; exit 1; }
[[ -f "$ROOT/src/ecosystem/ecosystem.module.ts" ]] || { echo "No encontré ecosystem.module.ts"; exit 1; }

# =============================================================================
# 1 — Reescribir CommonModule para que exporte EcosystemModule
# =============================================================================
section "common.module.ts — agregar EcosystemModule a imports y exports"

cp "$ROOT/src/common/common.module.ts" "$ROOT/src/common/common.module.ts.bak"
echo "[→] backup → common.module.ts.bak"

cat > "$ROOT/src/common/common.module.ts" << 'EOF'
// src/common/common.module.ts
//
// Módulo global — exporta servicios comunes y EcosystemModule.
// Al ser @Global() + exportar EcosystemModule, EcosystemService queda
// disponible en TODOS los módulos sin necesidad de importarlo individualmente.
// Esto es necesario porque TenantGuard inyecta EcosystemService y se usa
// en controllers de múltiples módulos.
import { Global, Module } from '@nestjs/common';
import { EmbeddingService } from './services/embedding.service';
import { CacheService }     from './services/cache.service';
import { EcosystemModule }  from '../ecosystem/ecosystem.module';
import { GroqModule }       from '../groq/groq.module';

@Global()
@Module({
  imports:   [GroqModule, EcosystemModule],
  providers: [EmbeddingService, CacheService],
  exports:   [EmbeddingService, CacheService, EcosystemModule],
})
export class CommonModule {}
EOF

ok "common.module.ts actualizado"

# =============================================================================
# 2 — Verificar que AgentsModule existe (mínimo necesario)
# =============================================================================
section "agents.module.ts — verificar"

AGENTS_MOD="$ROOT/src/agents/agents.module.ts"

if grep -q 'EcosystemModule' "$AGENTS_MOD"; then
  echo "[→] AgentsModule ya importa EcosystemModule — no se toca"
else
  echo "[→] AgentsModule no importa EcosystemModule — no es necesario (CommonModule es @Global)"
fi

ok "AgentsModule verificado — no requiere cambios"

# =============================================================================
section "Fix completado"

echo ""
echo "  Cambio aplicado:"
echo "    ~ src/common/common.module.ts"
echo "      imports:  [GroqModule, EcosystemModule]  ← EcosystemModule agregado"
echo "      exports:  [..., EcosystemModule]           ← exportado globalmente"
echo ""
echo "  Efecto: EcosystemService disponible en TODOS los módulos via @Global()"
echo "  Sin necesidad de importar EcosystemModule individualmente en cada módulo."
echo ""
echo "  Próximos pasos:"
echo "    git add . && git commit -m 'fix: CommonModule exporta EcosystemModule globalmente'"
echo "    git push origin main"
echo "    → Railway redeploya chat-ia-back"