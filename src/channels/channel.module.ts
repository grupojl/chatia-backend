// src/channels/channel.module.ts
import { Module } from '@nestjs/common';
import { ChannelRegistry } from './channel.registry';
import { WhatsAppChannel } from './whatsapp/whatsapp.channel';
import { InstagramChannel } from './instagram/instagram.channel';
import { MessengerChannel } from './messenger/messenger.channel';
import { TikTokChannel } from './tiktok/tiktok.channel';

@Module({
  providers: [
    ChannelRegistry,
    WhatsAppChannel,
    InstagramChannel,
    MessengerChannel,
    TikTokChannel,
  ],
  exports: [ChannelRegistry],
})
export class ChannelsModule {}
