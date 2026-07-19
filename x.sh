#!/usr/bin/env bash
# =============================================================================
# cleanup-chat-ia-back.sh
# Elimina dead code del proyecto chat-ia-back identificado en code review.
#
# Qué hace:
#   1. Borra app.controller.ts + app.service.ts (boilerplate nunca usado,
#      health duplicado con HealthModule)
#   2. Borra ai-config/dto/create-ai-config.dto.ts y entities/ai-config.entity.ts
#      (esqueletos vacíos generados por CLI, nunca completados)
#   3. Reemplaza ai-config/dto/update-ai-config.dto.ts (dependía del DTO vacío)
#   4. Reescribe app.module.ts sin AppController ni AppService
#
# Qué NO toca:
#   - src/modules/manzana|mexus|welver  → placeholders intencionales
#   - src/ai-config/ai-config.controller.ts + ai-config.service.ts → funcionan
#   - Cualquier otra lógica de negocio
#
# Uso:
#   cd <raíz del repo chat-ia-back>
#   bash cleanup-chat-ia-back.sh
# =============================================================================

set -euo pipefail

ROOT="$(pwd)"
SRC="$ROOT/src"

# ── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[OK]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
remove()  { echo -e "${RED}[DEL]${NC} $*"; }

# ── Verificar que estamos en la raíz correcta ────────────────────────────────
if [[ ! -f "$SRC/main.ts" ]]; then
  echo "ERROR: No se encontró src/main.ts — ejecutá el script desde la raíz de chat-ia-back."
  exit 1
fi

echo ""
echo "=== cleanup-chat-ia-back ==="
echo "Directorio: $ROOT"
echo ""

# =============================================================================
# 1. Borrar app.controller.ts
#    Tenía un GET /health duplicado con distinta info que HealthController.
#    Se queda HealthModule con /api/v1/health (incluye uptime, version, env).
# =============================================================================
TARGET="$SRC/app.controller.ts"
if [[ -f "$TARGET" ]]; then
  rm "$TARGET"
  remove "src/app.controller.ts"
else
  warn "src/app.controller.ts ya no existe, se omite"
fi

# =============================================================================
# 2. Borrar app.service.ts
#    Solo tenía getHello(): string { return 'Hello World!'; }
#    Nunca fue inyectado en ningún otro servicio.
# =============================================================================
TARGET="$SRC/app.service.ts"
if [[ -f "$TARGET" ]]; then
  rm "$TARGET"
  remove "src/app.service.ts"
else
  warn "src/app.service.ts ya no existe, se omite"
fi

# =============================================================================
# 3. Borrar ai-config/dto/create-ai-config.dto.ts  (clase vacía)
#    El AiConfigService usa sus propios tipos inline, este DTO nunca fue llenado.
# =============================================================================
TARGET="$SRC/ai-config/dto/create-ai-config.dto.ts"
if [[ -f "$TARGET" ]]; then
  rm "$TARGET"
  remove "src/ai-config/dto/create-ai-config.dto.ts"
else
  warn "create-ai-config.dto.ts ya no existe, se omite"
fi

# =============================================================================
# 4. Borrar ai-config/entities/ai-config.entity.ts  (clase vacía)
#    El controller y service importan directamente de @prisma/client.
# =============================================================================
TARGET="$SRC/ai-config/entities/ai-config.entity.ts"
if [[ -f "$TARGET" ]]; then
  rm "$TARGET"
  remove "src/ai-config/entities/ai-config.entity.ts"
else
  warn "ai-config.entity.ts ya no existe, se omite"
fi

# =============================================================================
# 5. Reemplazar update-ai-config.dto.ts
#    El original extendía el DTO vacío con PartialType → resultado: clase vacía.
#    Lo reemplazamos con los campos reales que el AiConfigController acepta.
# =============================================================================
TARGET="$SRC/ai-config/dto/update-ai-config.dto.ts"
cat > "$TARGET" << 'TYPESCRIPT'
// src/ai-config/dto/update-ai-config.dto.ts
import {
  IsString, IsNumber, IsBoolean, IsOptional,
  IsArray, Min, Max,
} from 'class-validator';

/**
 * DTO para actualizar la configuración de IA de un ChannelAccount.
 * Todos los campos son opcionales — se aplica patch parcial.
 */
export class UpdateAiConfigDto {
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  personaName?: string;

  @IsOptional()
  @IsString()
  groqModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(256)
  @Max(4096)
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  contextWindowSize?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  humanTakeoverKeywords?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  autoResolveAfterHours?: number;

  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  @IsOptional()
  @IsString()
  offlineMessage?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
TYPESCRIPT
info "src/ai-config/dto/update-ai-config.dto.ts reemplazado con campos reales"

# =============================================================================
# 6. Reescribir app.module.ts sin AppController ni AppService
#    Se mantiene todo lo demás intacto — solo se quitan las dos referencias.
# =============================================================================
TARGET="$SRC/app.module.ts"
cat > "$TARGET" << 'TYPESCRIPT'
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { FirebaseModule } from './firebase/firebase.module';
import { ConfigModule } from '@nestjs/config';

// Infraestructura
import { AgentsModule } from './agents/agents.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { EventsModule } from './events/events.module';

// Config tipada + validación
import {
  appConfig, dbConfig, groqConfig,
  redisConfig, metaConfig, firebaseConfig,
} from './config/app.config';
import { validationSchema } from './config/validation.schema';

// Módulos de dominio
import { ChannelsModule }       from './channels/channel.module';
import { GroqModule }           from './groq/groq.module';
import { LangGraphModule }      from './langgraph/langgraph.module';
import { ConversationsModule }  from './conversations/conversations.module';
import { WebhooksModule }       from './webhooks/webhooks.module';
import { MessagesModule }       from './messages/messages.module';
import { ContactsModule }       from './contacts/contacts.module';
import { AiConfigModule }       from './ai-config/ai-config.module';
import { ChannelAccountsModule } from './channel-accounts/channel-accounts.module';
import { NotificationsModule }  from './notifications/notifications.module';
import { AnalyticsModule }      from './analytics/analytics.module';
import { ProjectsModule }       from './projects/projects.module';
import { CommonModule }         from './common/common.module';
import { OrganizationsModule }  from './organizations/organizations.module';
import { HealthModule }         from './health/health.module';
import { AssistantModule }      from './assistant/assistant.module';
import { WidgetModule }         from './widget/widget.module';
import { FaqModule }            from './faq/faq.module';

// Guards
import { TenantThrottlerGuard } from './common/guards/tenant-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, groqConfig, redisConfig, metaConfig, firebaseConfig],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
      { name: 'burst',   ttl: 5_000,  limit: 20 },
    ]),
    PrismaModule,
    FirebaseModule,
    AgentsModule,
    QueueModule,
    EventsModule,
    ChannelsModule,
    GroqModule,
    LangGraphModule,
    ConversationsModule,
    WebhooksModule,
    MessagesModule,
    ContactsModule,
    AiConfigModule,
    ChannelAccountsModule,
    NotificationsModule,
    AnalyticsModule,
    CommonModule,
    OrganizationsModule,
    HealthModule,
    ProjectsModule,
    AssistantModule,
    FaqModule,
    WidgetModule,
  ],
  // Sin AppController ni AppService — health vive en HealthModule (/api/v1/health)
  providers: [
    { provide: APP_GUARD, useClass: TenantThrottlerGuard },
  ],
})
export class AppModule {}
TYPESCRIPT
info "src/app.module.ts reescrito — AppController y AppService eliminados"

# =============================================================================
# Resumen
# =============================================================================
echo ""
echo "=== Resumen ==="
echo "Archivos eliminados:"
echo "  - src/app.controller.ts         (health duplicado con HealthModule)"
echo "  - src/app.service.ts            (getHello boilerplate)"
echo "  - src/ai-config/dto/create-ai-config.dto.ts  (clase vacía)"
echo "  - src/ai-config/entities/ai-config.entity.ts (clase vacía)"
echo ""
echo "Archivos modificados:"
echo "  - src/ai-config/dto/update-ai-config.dto.ts  (reemplazado con campos reales)"
echo "  - src/app.module.ts                           (sin AppController/AppService)"
echo ""
echo "Próximo paso recomendado:"
echo "  pnpm build   →  verificar que compila sin errores"
echo ""