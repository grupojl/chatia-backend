// src/channels/whatsapp/whatsapp.channel.ts
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  IChannel,
  IncomingMessage,
  OutgoingMessage,
  ChannelAccountConfig,
} from '../channel.interface';

@Injectable()
export class WhatsAppChannel implements IChannel {
  private readonly logger = new Logger(WhatsAppChannel.name);
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
      const entry = payload?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value?.messages?.length) return null;

      return value.messages.map((msg: any): IncomingMessage => {
        const contact = value.contacts?.find((c: any) => c.wa_id === msg.from);
        return {
          externalId: msg.id,
          senderExternalId: msg.from,
          senderPhone: msg.from,
          senderName: contact?.profile?.name,
          type: this.mapMessageType(msg.type),
          content: this.extractContent(msg),
          mediaUrl: this.extractMediaUrl(msg),
          timestamp: new Date(parseInt(msg.timestamp) * 1000),
          raw: msg,
        };
      });
    } catch (err) {
      this.logger.error('Error parseando webhook WhatsApp', err);
      return null;
    }
  }

  async sendMessage(msg: OutgoingMessage, config: ChannelAccountConfig): Promise<void> {
    const phoneNumberId = config.externalId;
    const url = `${this.API_URL}/${phoneNumberId}/messages`;

    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: msg.to,
    };

    if (msg.type === 'text') {
      body.type = 'text';
      body.text = { body: msg.content, preview_url: false };
    } else if (msg.type === 'image' && msg.mediaUrl) {
      body.type = 'image';
      body.image = { link: msg.mediaUrl, caption: msg.content };
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
      throw new Error(`WhatsApp send failed: ${error}`);
    }
  }

  private mapMessageType(type: string): IncomingMessage['type'] {
    const map: Record<string, IncomingMessage['type']> = {
      text: 'text',
      image: 'image',
      audio: 'audio',
      video: 'video',
      document: 'document',
      sticker: 'sticker',
      location: 'location',
    };
    return map[type] ?? 'text';
  }

  private extractContent(msg: any): string {
    if (msg.type === 'text') return msg.text?.body ?? '';
    if (msg.type === 'image') return msg.image?.caption ?? '[imagen]';
    if (msg.type === 'audio') return '[audio]';
    if (msg.type === 'video') return msg.video?.caption ?? '[video]';
    if (msg.type === 'document') return msg.document?.filename ?? '[documento]';
    if (msg.type === 'sticker') return '[sticker]';
    if (msg.type === 'location') {
      return `[ubicación] lat: ${msg.location?.latitude}, lon: ${msg.location?.longitude}`;
    }
    return '[mensaje]';
  }

  private extractMediaUrl(msg: any): string | undefined {
    return msg.image?.id || msg.video?.id || msg.audio?.id || msg.document?.id;
  }
}