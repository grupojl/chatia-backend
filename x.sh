#!/usr/bin/env bash
# =============================================================================
# fix-chatia-redis-modules-v3.sh
# Reescribe faq.module.ts, assistant.module.ts y webhooks.module.ts
# con REDIS_ENABLED declarado correctamente como constante de módulo.
# Repo: chatia-backend
# =============================================================================
set -euo pipefail

if [ ! -f "src/faq/faq.module.ts" ]; then
  echo "❌  Corré desde la raíz del repo chatia-backend"
  exit 1
fi

# ── faq.module.ts ─────────────────────────────────────────────────────────────
cp src/faq/faq.module.ts src/faq/faq.module.ts.bak
cat > src/faq/faq.module.ts << 'TSEOF'
// src/faq/faq.module.ts
import { Module }                from '@nestjs/common';
import { BullModule }            from '@nestjs/bullmq';
import { FaqController }         from './faq.controller';
import { KnowledgeBaseService }  from './knowledge-base/knowledge-base.service';
import { KbDocumentService }     from './document/kb-document.service';
import { FaqIngestionService }   from './ingestion/faq-ingestion.service';
import { FaqIngestionProcessor } from './ingestion/faq-ingestion.processor';
import { FaqQueryService }       from './query/faq-query.service';
import { RagService }            from './rag/rag.service';
import { EmbeddingService }      from '../common/services/embedding.service';
import { CacheService }          from '../common/services/cache.service';
import { GroqModule }            from '../groq/groq.module';
import { QUEUES }                from '../queue/queue.constants';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';

@Module({
  imports: [
    GroqModule,
    ...(REDIS_ENABLED ? [
      BullModule.registerQueue({
        name: QUEUES.FAQ_INGEST,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
    ] : []),
  ],
  controllers: [FaqController],
  providers: [
    KnowledgeBaseService,
    KbDocumentService,
    FaqIngestionService,
    FaqQueryService,
    RagService,
    EmbeddingService,
    CacheService,
    ...(REDIS_ENABLED ? [FaqIngestionProcessor] : []),
  ],
  exports: [FaqQueryService, KnowledgeBaseService, RagService],
})
export class FaqModule {}
TSEOF
echo "✅  faq.module.ts"

# ── assistant.module.ts ───────────────────────────────────────────────────────
cp src/assistant/assistant.module.ts src/assistant/assistant.module.ts.bak
cat > src/assistant/assistant.module.ts << 'TSEOF'
// src/assistant/assistant.module.ts
import { Module }                  from '@nestjs/common';
import { BullModule }              from '@nestjs/bullmq';
import { AssistantController }     from './assistant.controller';
import { AssistantChatService }    from './chat/assistant-chat.service';
import { AssistantConfigService }  from './config/assistant-config.service';
import { AssistantSessionService } from './session/assistant-session.service';
import { AssistantChatProcessor }  from './processors/assistant-chat.processor';
import { GroqModule }              from '../groq/groq.module';
import { EventsModule }            from '../events/events.module';
import { FaqModule }               from '../faq/faq.module';
import { QUEUES }                  from '../queue/queue.constants';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';

@Module({
  imports: [
    GroqModule,
    EventsModule,
    FaqModule,
    ...(REDIS_ENABLED ? [
      BullModule.registerQueue({
        name: QUEUES.ASSISTANT_CHAT,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      }),
    ] : []),
  ],
  controllers: [AssistantController],
  providers: [
    AssistantChatService,
    AssistantConfigService,
    AssistantSessionService,
    ...(REDIS_ENABLED ? [AssistantChatProcessor] : []),
  ],
  exports: [AssistantChatService, AssistantConfigService, AssistantSessionService],
})
export class AssistantModule {}
TSEOF
echo "✅  assistant.module.ts"

# ── webhooks.module.ts ────────────────────────────────────────────────────────
cp src/webhooks/webhooks.module.ts src/webhooks/webhooks.module.ts.bak
cat > src/webhooks/webhooks.module.ts << 'TSEOF'
// src/webhooks/webhooks.module.ts
import { Module }              from '@nestjs/common';
import { BullModule }          from '@nestjs/bullmq';
import { WebhooksController }  from './webhooks.controller';
import { WebhooksService }     from './webhooks.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { ChannelsModule }      from '../channels/channel.module';
import { QueueModule }         from '../queue/queue.module';
import { QUEUES }              from '../queue/queue.constants';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';

@Module({
  imports: [
    ConversationsModule,
    ChannelsModule,
    QueueModule,
    ...(REDIS_ENABLED ? [
      BullModule.registerQueue({ name: QUEUES.INCOMING_MESSAGE }),
    ] : []),
  ],
  controllers: [WebhooksController],
  providers:   [WebhooksService],
})
export class WebhooksModule {}
TSEOF
echo "✅  webhooks.module.ts"

echo ""
echo "🔍  También necesitamos verificar conversations.module.ts..."
CONV="src/conversations/conversations.module.ts"
if grep -q "BullModule.registerQueue" "$CONV" && ! grep -q "REDIS_ENABLED" "$CONV"; then
  cp "$CONV" "${CONV}.bak"
  cat > "$CONV" << 'TSEOF'
// src/conversations/conversations.module.ts
import { Module }              from '@nestjs/common';
import { BullModule }          from '@nestjs/bullmq';
import { ConversationsController } from './conversations.controller';
import { ConversationsService }    from './conversations.service';
import { LangGraphModule }     from '../langgraph/langgraph.module';
import { ChannelsModule }      from '../channels/channel.module';
import { EventsModule }        from '../events/events.module';
import { AssignmentModule }    from '../assignment/assignment.module';
import { AssistantModule }     from '../assistant/assistant.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QUEUES }              from '../queue/queue.constants';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';

@Module({
  imports: [
    LangGraphModule,
    ChannelsModule,
    EventsModule,
    AssignmentModule,
    NotificationsModule,
    AssistantModule,
    ...(REDIS_ENABLED ? [
      BullModule.registerQueue({ name: QUEUES.OUTGOING_MESSAGE }),
    ] : []),
  ],
  controllers: [ConversationsController],
  providers:   [ConversationsService],
  exports:     [ConversationsService],
})
export class ConversationsModule {}
TSEOF
  echo "✅  conversations.module.ts"
else
  echo "⚠️  conversations.module.ts — sin cambios necesarios"
fi

echo ""
echo "🔍  Buscando otros módulos con BullModule.registerQueue sin REDIS_ENABLED..."
grep -rl "BullModule.registerQueue" src/ --include="*.module.ts" | while read f; do
  if ! grep -q "REDIS_ENABLED" "$f"; then
    echo "   ⚠️  $f — tiene BullModule.registerQueue sin guard REDIS_ENABLED"
  fi
done

echo ""
echo "✅  Todos los módulos actualizados"