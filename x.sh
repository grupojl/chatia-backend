#!/usr/bin/env bash
# =============================================================================
# fix-chatia-webhooks-conversations-service.sh
# Fix: WebhooksService y ConversationsService tienen @InjectQueue sin @Optional.
# También busca todos los demás @InjectQueue sin @Optional en el proyecto.
# Repo: chatia-backend
# =============================================================================
set -euo pipefail

if [ ! -f "src/webhooks/webhooks.service.ts" ]; then
  echo "❌  Corré desde la raíz del repo chatia-backend"
  exit 1
fi

# ── webhooks.service.ts ───────────────────────────────────────────────────────
cp src/webhooks/webhooks.service.ts src/webhooks/webhooks.service.ts.bak
cat > src/webhooks/webhooks.service.ts << 'TSEOF'
// src/webhooks/webhooks.service.ts
import { Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue }       from 'bullmq';
import { PrismaService }    from '../prisma/prisma.service';
import { ChannelRegistry }  from '../channels/channel.registry';
import { ChannelType }      from '@prisma/client';
import { QUEUES, JOBS }     from '../queue/queue.constants';
import type { IncomingMessageJobData } from '../queue/processors/incoming-message.processor';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma:           PrismaService,
    private readonly channelRegistry:  ChannelRegistry,
    @Optional() @InjectQueue(QUEUES.INCOMING_MESSAGE)
    private readonly incomingQueue: Queue<IncomingMessageJobData> | null,
  ) {}

  async verify(channelType: ChannelType, externalId: string, query: Record<string, string>) {
    const account = await this.prisma.channelAccount.findUnique({
      where: { channelType_externalId: { channelType, externalId } },
    });
    if (!account) throw new UnauthorizedException();

    const channel   = this.channelRegistry.get(channelType);
    const challenge = channel.verifyWebhook(query, {
      externalId:          account.externalId,
      accessToken:         account.accessToken,
      extraConfig:         account.extraConfig as Record<string, unknown>,
      webhookVerifyToken:  account.webhookVerifyToken,
    });

    if (challenge === false) throw new UnauthorizedException('Token inválido');
    return challenge;
  }

  async handleEvent(
    channelType: ChannelType,
    externalId:  string,
    payload:     unknown,
    rawBody:     Buffer,
    signature?:  string,
  ) {
    const account = await this.prisma.channelAccount.findUnique({
      where: { channelType_externalId: { channelType, externalId } },
    });
    if (!account) throw new UnauthorizedException();

    const channel = this.channelRegistry.get(channelType);

    if (signature) {
      const valid = channel.verifySignature?.(
        rawBody,
        signature,
        account.webhookVerifyToken ?? '',
      );
      if (valid === false) throw new UnauthorizedException('Firma inválida');
    }

    const msg = channel.parseIncomingWebhook(payload);
    if (!msg || msg.length === 0) return { status: 'ignored' };

    if (!this.incomingQueue) {
      this.logger.warn('[no-op] webhook recibido pero cola deshabilitada (REDIS_ENABLED=false)');
      return { status: 'ok-noop' };
    }

    for (const m of msg) {
      await this.incomingQueue.add(
        JOBS.PROCESS_MESSAGE,
        { channelAccountId: account.id, channelType, msg: m },
        {
          jobId:    `msg:${account.id}:${m.externalId}`,
          attempts: 3,
          backoff:  { type: 'exponential', delay: 2000 },
        },
      );
    }

    return { status: 'ok' };
  }
}
TSEOF
echo "✅  webhooks.service.ts"

# ── conversations.service.ts — outgoingQueue ──────────────────────────────────
CONV="src/conversations/conversations.service.ts"
if [ -f "$CONV" ] && grep -q "@InjectQueue" "$CONV" && ! grep -q "@Optional" "$CONV"; then
  cp "$CONV" "${CONV}.bak"
  # Agregar Optional al import de @nestjs/common
  sed -i "s|import { Injectable|import { Injectable, Optional|" "$CONV"
  # Hacer la queue opcional
  sed -i "s|@InjectQueue(QUEUES.OUTGOING_MESSAGE)\n    private readonly outgoingQueue|@Optional() @InjectQueue(QUEUES.OUTGOING_MESSAGE)\n    private readonly outgoingQueue|" "$CONV"
  # sed en una sola línea por si está en la misma línea
  sed -i "s|@InjectQueue(QUEUES.OUTGOING_MESSAGE) private readonly outgoingQueue: Queue<OutgoingMessageJobData>|@Optional() @InjectQueue(QUEUES.OUTGOING_MESSAGE) private readonly outgoingQueue: Queue<OutgoingMessageJobData> \| null|" "$CONV"
  echo "✅  conversations.service.ts (sed básico — verificá manualmente)"
fi

# ── assistant chat service — ASSISTANT_CHAT queue ────────────────────────────
ASST="src/assistant/processors/assistant-chat.processor.ts"
# El processor ya es condicional en el módulo — OK

# ── Reporte final: todos los @InjectQueue sin @Optional ──────────────────────
echo ""
echo "🔍  Servicios con @InjectQueue sin @Optional (verificar):"
grep -r "@InjectQueue" src/ --include="*.ts" -l | while read f; do
  if grep -q "@InjectQueue" "$f" && ! grep -q "@Optional" "$f"; then
    echo "   ⚠️  $f"
    grep -n "@InjectQueue" "$f"
  fi
done

echo ""
echo "✅  Fix aplicado — reiniciá el contenedor"