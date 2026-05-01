// src/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from './queue.constants';
import { IncomingMessageProcessor } from './processors/incoming-message.processor';
import { OutgoingMessageProcessor } from './processors/outgoing-message.processor';
import { ChannelsModule } from '../channels/channel.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      },
    }),
    BullModule.registerQueue(
      {
        name: QUEUES.INCOMING_MESSAGE,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      },
      {
        name: QUEUES.OUTGOING_MESSAGE,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      },
    ),
    ChannelsModule,
    ConversationsModule,
    EventsModule,
  ],
  providers: [IncomingMessageProcessor, OutgoingMessageProcessor],
  exports: [BullModule],
})
export class QueueModule {}
