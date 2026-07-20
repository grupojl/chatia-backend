#!/usr/bin/env bash
# =============================================================================
# fix-chat-ia-common-module.sh
# Fix: EmbeddingService no puede resolver GroqService en CommonModule
# Repo: chatia-backend (src en raíz, sin apps/)
# =============================================================================
set -euo pipefail

FILE="src/common/common.module.ts"

echo "🔍  Verificando $FILE ..."

if [ ! -f "$FILE" ]; then
  echo "❌  No se encontró $FILE"
  echo "    Asegurate de correr el script desde la raíz del repo chatia-backend"
  exit 1
fi

# Idempotencia
if grep -q "GroqModule" "$FILE"; then
  echo "⚠️  GroqModule ya está en common.module.ts — nada que hacer"
  exit 0
fi

echo "🔧  Aplicando fix ..."

# Backup
cp "$FILE" "${FILE}.bak"
echo "💾  Backup guardado en ${FILE}.bak"

# Reescribir el archivo completo con el contenido correcto
cat > "$FILE" << 'TSEOF'
// src/common/common.module.ts
// Módulo que exporta servicios comunes utilizados por guards y módulos de negocio.
import { Global, Module } from '@nestjs/common';
import { DashboardAuthService } from './services/dashboard-auth.service';
import { EmbeddingService }     from './services/embedding.service';
import { CacheService }         from './services/cache.service';
import { GroqModule }           from '../groq/groq.module';

@Global()
@Module({
  imports: [GroqModule],
  providers: [DashboardAuthService, EmbeddingService, CacheService],
  exports:   [DashboardAuthService, EmbeddingService, CacheService],
})
export class CommonModule {}
TSEOF

echo "✅  common.module.ts actualizado"
echo ""
echo "📄  Contenido final:"
cat "$FILE"