// src/channels/channel.registry.ts
import { Injectable } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import type { IChannel } from './channel.interface';
import { WhatsAppChannel } from './whatsapp/whatsapp.channel';
import { InstagramChannel } from './instagram/instagram.channel';
import { MessengerChannel } from './messenger/messenger.channel';
import { TikTokChannel } from './tiktok/tiktok.channel';

@Injectable()
export class ChannelRegistry {
  private readonly channels: Map<ChannelType, IChannel>;

  constructor(
    private readonly whatsapp: WhatsAppChannel,
    private readonly instagram: InstagramChannel,
    private readonly messenger: MessengerChannel,
    private readonly tiktok: TikTokChannel,
  ) {
    this.channels = new Map<ChannelType, IChannel>([
      [ChannelType.WHATSAPP, this.whatsapp],
      [ChannelType.INSTAGRAM, this.instagram],
      [ChannelType.MESSENGER, this.messenger],
      [ChannelType.TIKTOK, this.tiktok],
    ]);
  }

  get(type: ChannelType): IChannel {
    const channel = this.channels.get(type);
    if (!channel) throw new Error(`Canal no soportado: ${type}`);
    return channel;
  }
}