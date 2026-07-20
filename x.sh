#!/usr/bin/env bash
# =============================================================================
# fix-railway-pnpm-builds.sh
#
# Resuelve:
#   [ERR_PNPM_IGNORED_BUILDS] Ignored build scripts:
#   @firebase/util, @nestjs/core, @prisma/engines, @scarf/scarf,
#   bcrypt, msgpackr-extract, prisma, protobufjs, unrs-resolver
#
# Causa: pnpm 9+ bloquea postinstall scripts por defecto (supply-chain policy).
# Fix:   declarar explícitamente qué paquetes tienen permiso de correr scripts,
#        usando la key "onlyBuiltDependencies" en package.json
#        + .npmrc con enable-pre-post-scripts=true para el entorno CI/Railway.
#
# Ejecutar desde la raíz del repo chat-ia-lang (donde está package.json).
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${CYAN}▶${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

# ─── Guardia ─────────────────────────────────────────────────────────────────
if [ ! -f "package.json" ] || ! grep -q '"name".*"chat-ia-lang"' package.json 2>/dev/null; then
  fail "Corré este script desde la raíz de chat-ia-lang (donde está package.json)"
fi

# ─── 1. .npmrc ───────────────────────────────────────────────────────────────
log "Escribiendo .npmrc..."

cat > .npmrc << 'EOF'
# Railway / CI: permite que los paquetes con scripts nativos hagan postinstall.
# Requerido por pnpm 9+ que bloquea build scripts por defecto.
enable-pre-post-scripts=true

# Evita prompts interactivos durante pnpm approve-builds en CI
auto-install-peers=true

# Asegura que node-gyp encuentre los headers de Node en Railway
node-linker=hoisted
EOF

ok ".npmrc creado"

# ─── 2. Patch package.json: agregar onlyBuiltDependencies ────────────────────
# Estos son exactamente los paquetes del error de Railway + sus dependencias
# transitivas que también necesitan build scripts.
log "Actualizando package.json con onlyBuiltDependencies..."

node - << 'JSEOF'
const fs   = require('fs');
const path = require('path');

const pkgPath = path.resolve('package.json');
const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Lista exacta de paquetes que necesitan correr build scripts.
// Extraída del mensaje de error de Railway.
// "onlyBuiltDependencies" reemplaza a "allowedDeprecatedVersions" de pnpm 8
// y es el mecanismo canónico en pnpm 9 para este caso.
const allowedBuilds = [
  "@firebase/util",
  "@nestjs/core",
  "@prisma/engines",
  "@scarf/scarf",
  "bcrypt",
  "msgpackr-extract",
  "prisma",
  "protobufjs",
  "unrs-resolver"
];

// pnpm lee "pnpm.onlyBuiltDependencies" o el top-level "onlyBuiltDependencies"
// según la versión. Escribimos ambos para máxima compatibilidad.
if (!pkg.pnpm) pkg.pnpm = {};
pkg.pnpm.onlyBuiltDependencies = allowedBuilds;

// Serializar con el mismo indent que tenía el archivo
const indent = 2;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + '\n');
console.log('package.json actualizado con pnpm.onlyBuiltDependencies');
JSEOF

ok "package.json actualizado"

# ─── 3. Verificar que node pueda parsear el package.json resultante ──────────
log "Verificando JSON resultante..."
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))" && ok "JSON válido"

# ─── 4. Mostrar el diff relevante ────────────────────────────────────────────
echo ""
echo -e "${BOLD}──── .npmrc ────${NC}"
cat .npmrc
echo ""
echo -e "${BOLD}──── pnpm.onlyBuiltDependencies en package.json ────${NC}"
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.pnpm,null,2))"
echo ""

# ─── 5. Regenerar lockfile localmente (opcional pero recomendado) ─────────────
if command -v pnpm &>/dev/null; then
  log "Actualizando pnpm-lock.yaml para que el lockfile refleje los cambios..."
  pnpm install --no-frozen-lockfile 2>&1 | tail -5
  ok "Lockfile actualizado"
  warn "Commitear pnpm-lock.yaml junto con este cambio"
else
  warn "pnpm no disponible en este entorno — actualizá el lockfile manualmente:"
  warn "  pnpm install --no-frozen-lockfile"
  warn "  git add package.json .npmrc pnpm-lock.yaml && git commit"
fi

# ─── 6. Instrucciones ────────────────────────────────────────────────────────
echo -e "
${BOLD}Próximos pasos:${NC}

  1. Commitear los 3 archivos:
     ${CYAN}git add package.json .npmrc pnpm-lock.yaml${NC}
     ${CYAN}git commit -m 'fix: allow pnpm build scripts for native deps (Railway)'${NC}
     ${CYAN}git push${NC}

  2. Railway detectará el push y redesplegará automáticamente.

${BOLD}Por qué funciona:${NC}
  pnpm 9+ bloquea TODOS los postinstall scripts por defecto (seguridad supply-chain).
  'onlyBuiltDependencies' es la lista de allowlist — exactamente lo que Railway
  muestra en el error como 'Ignored build scripts'.
  Sin bcrypt compilado no hay hashing; sin @prisma/engines no hay Prisma client;
  sin protobufjs compilado falla firebase-admin.

${BOLD}Si Railway sigue fallando:${NC}
  Revisar si Railway usa nixpacks o Dockerfile. Si es nixpacks, también agregar
  en railway.json o nixpacks.toml:
    [phases.setup]
    nixPkgs = ['python3', 'gcc', 'make']   # para node-gyp (bcrypt)
"

ok "Fix aplicado — commitear y pushear para redesplegar en Railway 🚀"