// src/channels/tiktok/tiktok.channel.ts
//
// TikTok Direct Messages usan la TikTok for Business API (v2).
// Docs: https://developers.tiktok.com/doc/direct-messages-overview
//
// Nota: TikTok DMs requieren aprobación de la app por parte de TikTok.
// La verificación del webhook usa un token de verificación diferente al de Meta.

import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  IChannel,
  IncomingMessage,
  OutgoingMessage,
  ChannelAccountConfig,
} from '../channel.interface';

@Injectable()
export class TikTokChannel implements IChannel {
  private readonly logger = new Logger(TikTokChannel.name);
  private readonly API_URL = 'https://open.tiktokapis.com/v2';

  verifyWebhook(
    query: Record<string, string>,
    config: ChannelAccountConfig,
  ): string | false {
    // TikTok usa un GET con challenge
    if (query['verify_token'] === config.webhookVerifyToken && query['challenge']) {
      return query['challenge'];
    }
    return false;
  }

  verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
    // TikTok firma con HMAC-SHA256 en el header X-Tiktok-Signature
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  parseIncomingWebhook(payload: any): IncomingMessage[] | null {
    try {
      // Estructura TikTok for Business DM webhook
      const event = payload?.event;
      if (event !== 'direct_message') return null;

      const dm = payload?.data;
      if (!dm) return null;

      return [
        {
          externalId: dm.message_id,
          senderExternalId: dm.from?.open_id ?? dm.from?.user_id,
          senderName: dm.from?.display_name,
          senderAvatarUrl: dm.from?.avatar_url,
          senderUsername: dm.from?.username,
          type: dm.message_type === 'text' ? 'text' : 'image',
          content: dm.content?.text ?? dm.content?.url ?? '[mensaje]',
          mediaUrl: dm.content?.url,
          timestamp: new Date(dm.create_time * 1000),
          raw: payload,
        },
      ];
    } catch (err) {
      this.logger.error('Error parseando webhook TikTok', err);
      return null;
    }
  }

  async sendMessage(msg: OutgoingMessage, config: ChannelAccountConfig): Promise<void> {
    const url = `${this.API_URL}/direct/message/send/`;

    const body: Record<string, unknown> = {
      to_user_id: msg.to,
    };

    if (msg.type === 'text') {
      body.message_type = 'text';
      body.content = { text: msg.content };
    } else if (msg.type === 'image' && msg.mediaUrl) {
      body.message_type = 'image';
      body.content = { url: msg.mediaUrl };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`TikTok send failed: ${error}`);
    }
  }
}