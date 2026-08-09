// src/queue/queue.module.ts
// REDIS_ENABLED=false → BullModule no se inicializa, workers no corren.
// Los processors fallan silenciosamente si se encola sin Redis — aceptable en dev.
import { Module }      from '@nestjs/common';
import { BullModule }  from '@nestjs/bullmq';
import { QUEUES }      from './queue.constants';
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
  exports: [BullModule],
})
export class QueueModule {}
