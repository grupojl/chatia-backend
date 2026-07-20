#!/usr/bin/env bash
# =============================================================================
# fix-chat-ia-redis-disabled.sh
# Fix: BullExplorer escanea @Processor en toda la app aunque BullModule.forRoot
# no haya corrido. Solución: cuando REDIS_ENABLED=false, no registrar processors
# en NINGÚN módulo que los tenga.
# Repo: chatia-backend
# =============================================================================
set -euo pipefail

if [ ! -f "src/queue/queue.module.ts" ]; then
  echo "❌  Corré desde la raíz del repo chatia-backend"
  exit 1
fi

echo "🔧  Actualizando queue.module.ts..."
cat > src/queue/queue.module.ts << 'TSEOF'
// src/queue/queue.module.ts
import { Module }     from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES }     from './queue.constants';
import { IncomingMessageProcessor } from './processors/incoming-message.processor';
import { OutgoingMessageProcessor } from './processors/outgoing-message.processor';
import { ChannelsModule }      from '../channels/channel.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { EventsModule }        from '../events/events.module';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';
const REDIS_URL     = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

@Module({
  imports: [
    ...(REDIS_ENABLED ? [
      BullModule.forRoot({ connection: { url: REDIS_URL } }),
      BullModule.registerQueue(
        { name: QUEUES.INCOMING_MESSAGE, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 200 } },
        { name: QUEUES.OUTGOING_MESSAGE, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 200 } },
      ),
    ] : []),
    ChannelsModule,
    ConversationsModule,
    EventsModule,
  ],
  providers: REDIS_ENABLED ? [IncomingMessageProcessor, OutgoingMessageProcessor] : [],
  exports:   REDIS_ENABLED ? [BullModule] : [],
})
export class QueueModule {}
TSEOF
echo "✅  queue.module.ts"

# FaqModule — tiene FaqIngestionProcessor
echo "🔧  Actualizando faq/faq.module.ts..."
FAQ="src/faq/faq.module.ts"
[ -f "$FAQ" ] || { echo "⚠️  $FAQ no encontrado, saltando"; }
if [ -f "$FAQ" ]; then
  cp "$FAQ" "${FAQ}.bak"
  node -e "
const fs = require('fs');
let src = fs.readFileSync('$FAQ', 'utf8');

// Agregar constante REDIS_ENABLED al inicio si no existe
if (!src.includes('REDIS_ENABLED')) {
  src = src.replace(
    /^(import .+\n)+/m,
    (match) => match + \"\nconst REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';\n\"
  );
}

// Hacer providers y imports condicionales respecto al processor
src = src.replace(
  /providers: \[(\s*[\s\S]*?FaqIngestionProcessor[\s\S]*?)\]/,
  (match, inner) => {
    const withoutProcessor = inner.replace(/,?\s*FaqIngestionProcessor\s*,?/g, '');
    return \`providers: [
    \${withoutProcessor.trim()},
    ...(REDIS_ENABLED ? [FaqIngestionProcessor] : []),
  ]\`;
  }
);

// BullModule.registerQueue condicional
src = src.replace(
  /BullModule\.registerQueue\(\{[\s\S]*?\}\),?/,
  (match) => \`...(REDIS_ENABLED ? [\${match.replace(/,$/, '')}] : []),\`
);

fs.writeFileSync('$FAQ', src);
console.log('faq.module.ts actualizado');
"
fi

# WebhooksModule chat-ia — tiene workers de BullMQ
echo "🔧  Verificando src/webhooks/webhooks.module.ts..."
WEBHOOKS="src/webhooks/webhooks.module.ts"
if [ -f "$WEBHOOKS" ] && grep -q "BullModule" "$WEBHOOKS"; then
  cp "$WEBHOOKS" "${WEBHOOKS}.bak"
  node -e "
const fs = require('fs');
let src = fs.readFileSync('$WEBHOOKS', 'utf8');
if (!src.includes('REDIS_ENABLED')) {
  src = src.replace(
    /^(import .+\n)+/m,
    (match) => match + \"\nconst REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';\n\"
  );
  src = src.replace(
    /BullModule\.registerQueue\(\{[\s\S]*?\}\),?/,
    (match) => \`...(REDIS_ENABLED ? [\${match.replace(/,$/, '')}] : []),\`
  );
  fs.writeFileSync('$WEBHOOKS', src);
  console.log('webhooks.module.ts actualizado');
}
"
fi

# AssistantModule — puede tener BullModule.registerQueue
echo "🔧  Verificando src/assistant/assistant.module.ts..."
ASSISTANT="src/assistant/assistant.module.ts"
if [ -f "$ASSISTANT" ] && grep -q "BullModule" "$ASSISTANT"; then
  cp "$ASSISTANT" "${ASSISTANT}.bak"
  node -e "
const fs = require('fs');
let src = fs.readFileSync('$ASSISTANT', 'utf8');
if (!src.includes('REDIS_ENABLED')) {
  src = src.replace(
    /^(import .+\n)+/m,
    (match) => match + \"\nconst REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';\n\"
  );
  src = src.replace(
    /BullModule\.registerQueue\(\{[\s\S]*?\}\),?/g,
    (match) => \`...(REDIS_ENABLED ? [\${match.replace(/,$/, '')}] : []),\`
  );
  fs.writeFileSync('$ASSISTANT', src);
  console.log('assistant.module.ts actualizado');
}
"
fi

echo ""
echo "🔍  Buscando todos los @Processor en el proyecto..."
echo "    (estos módulos necesitan providers condicionales):"
grep -r "@Processor" src/ --include="*.ts" -l 2>/dev/null || echo "    ninguno adicional encontrado"

echo ""
echo "✅  Fix completo"
echo "   Asegurate de tener REDIS_ENABLED=false en las variables de entorno"