// src/queue/processors/outgoing-message.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../queue.constants';
import { ChannelRegistry } from '../../channels/channel.registry';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import { ChannelType } from '@prisma/client';

export interface OutgoingMessageJobData {
  messageId: string;
  conversationId: string;
  organizationId: string;
  channelType: ChannelType;
  recipientExternalId: string;
  text: string;
  accessToken: string;
  externalId: string;        // externalId del ChannelAccount (phone_number_id, page_id, etc.)
  extraConfig: Record<string, unknown>;
  webhookVerifyToken: string;
}

@Processor(QUEUES.OUTGOING_MESSAGE)
export class OutgoingMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(OutgoingMessageProcessor.name);

  constructor(
    private readonly channelRegistry: ChannelRegistry,
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {
    super();
  }

  async process(job: Job<OutgoingMessageJobData>): Promise<void> {
    const {
      messageId,
      channelType,
      recipientExternalId,
      text,
      accessToken,
      externalId,
      extraConfig,
      webhookVerifyToken,
    } = job.data;

    this.logger.debug(
      `[job:${job.id}] Enviando mensaje ${messageId} via ${channelType} — intento ${job.attemptsMade + 1}`,
    );

    const channel = this.channelRegistry.get(channelType);

    await channel.sendMessage(
      { to: recipientExternalId, type: 'text', content: text },
      { externalId, accessToken, extraConfig, webhookVerifyToken },
    );

    // Marcar como SENT si estaba PENDING
    await this.prisma.message.updateMany({
      where: { id: messageId, status: 'PENDING' },
      data: { status: 'SENT' },
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<OutgoingMessageJobData>, error: Error): Promise<void> {
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3);

    this.logger.error(
      `[job:${job.id}] Falló intento ${job.attemptsMade}/${job.opts.attempts} — ` +
        `mensaje: ${job.data.messageId} — error: ${error.message}`,
    );

    if (isLastAttempt) {
      // Marcar mensaje como FAILED en DB
      await this.prisma.message.updateMany({
        where: { id: job.data.messageId },
        data: { status: 'FAILED' },
      });

      // Notificar al front en tiempo real
      this.events.emitMessageFailed(
        job.data.organizationId,
        job.data.conversationId,
        job.data.messageId,
      );

      this.logger.error(
        `Mensaje ${job.data.messageId} marcado como FAILED tras ${job.attemptsMade} intentos`,
      );
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<OutgoingMessageJobData>): void {
    this.logger.debug(
      `[job:${job.id}] Enviado correctamente — mensaje: ${job.data.messageId}`,
    );
  }
}
