// src/channels/messenger/messenger.channel.ts
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  IChannel,
  IncomingMessage,
  OutgoingMessage,
  ChannelAccountConfig,
} from '../channel.interface';

// Messenger e Instagram comparten la misma Send API y formato de webhook.
// La diferencia es que Messenger usa pages, Instagram usa IG accounts.

@Injectable()
export class MessengerChannel implements IChannel {
  private readonly logger = new Logger(MessengerChannel.name);
  private readonly API_URL = 'https://graph.facebook.com/v19.0';

  verifyWebhook(
    query: Record<string, string>,
    config: ChannelAccountConfig,
  ): string | false {
    if (
      query['hub.mode'] === 'subscribe' &&
      query['hub.verify_token'] === config.webhookVerifyToken
    ) {
      return query['hub.challenge'];
    }
    return false;
  }

  verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const received = signature.replace('sha256=', '');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(received, 'hex'),
      );
    } catch {
      return false;
    }
  }

  parseIncomingWebhook(payload: any): IncomingMessage[] | null {
    try {
      const entries: IncomingMessage[] = [];

      for (const entry of payload?.entry ?? []) {
        for (const messaging of entry?.messaging ?? []) {
          if (!messaging.message) continue;

          const msg = messaging.message;
          entries.push({
            externalId: msg.mid,
            senderExternalId: messaging.sender.id,
            type: msg.attachments?.[0]?.type === 'image' ? 'image' : 'text',
            content: msg.text ?? msg.attachments?.[0]?.payload?.url ?? '[adjunto]',
            mediaUrl: msg.attachments?.[0]?.payload?.url,
            timestamp: new Date(messaging.timestamp),
            raw: messaging,
          });
        }
      }

      return entries.length ? entries : null;
    } catch (err) {
      this.logger.error('Error parseando webhook Messenger', err);
      return null;
    }
  }

  async sendMessage(msg: OutgoingMessage, config: ChannelAccountConfig): Promise<void> {
    const url = `${this.API_URL}/me/messages`;

    const body: Record<string, unknown> = {
      recipient: { id: msg.to },
      messaging_type: 'RESPONSE',
    };

    if (msg.type === 'text') {
      body.message = { text: msg.content };
    } else if (msg.type === 'image' && msg.mediaUrl) {
      body.message = {
        attachment: {
          type: 'image',
          payload: { url: msg.mediaUrl, is_reusable: true },
        },
      };
    }

    const res = await fetch(`${url}?access_token=${config.accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Messenger send failed: ${error}`);
    }
  }
}