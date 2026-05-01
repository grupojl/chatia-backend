// src/assistant/processors/assistant-chat.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../../queue/queue.constants';
import { AssistantChatService, ChatInput } from '../chat/assistant-chat.service';

export type AssistantChatJobData = ChatInput;

@Processor(QUEUES.ASSISTANT_CHAT)
export class AssistantChatProcessor extends WorkerHost {
  private readonly logger = new Logger(AssistantChatProcessor.name);

  constructor(private readonly chatService: AssistantChatService) {
    super();
  }

  async process(job: Job<AssistantChatJobData>): Promise<void> {
    this.logger.debug(
      `[job:${job.id}] Chat async — proyecto: ${job.data.projectSlug} — usuario: ${job.data.userId}`,
    );
    await this.chatService.chat(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AssistantChatJobData>, error: Error): void {
    this.logger.error(
      `[job:${job.id}] Falló intento ${job.attemptsMade}/${job.opts.attempts} — error: ${error.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AssistantChatJobData>): void {
    this.logger.debug(`[job:${job.id}] Completado — usuario: ${job.data.userId}`);
  }
}
