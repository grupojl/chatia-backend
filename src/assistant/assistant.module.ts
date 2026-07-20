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
