// src/webhooks/webhooks.service.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelRegistry } from '../channels/channel.registry';
import { ChannelType } from '@prisma/client';
import { QUEUES, JOBS } from '../queue/queue.constants';
import type { IncomingMessageJobData } from '../queue/processors/incoming-message.processor';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelRegistry: ChannelRegistry,
    @InjectQueue(QUEUES.INCOMING_MESSAGE)
    private readonly incomingQueue: Queue<IncomingMessageJobData>,
  ) {}

  async verify(
    channelType: ChannelType,
    externalId: string,
    query: Record<string, string>,
  ) {
    const account = await this.prisma.channelAccount.findUnique({
      where: { channelType_externalId: { channelType, externalId } },
    });
    if (!account) throw new UnauthorizedException();

    const channel = this.channelRegistry.get(channelType);
    const challenge = channel.verifyWebhook(query, {
      externalId: account.externalId,
      accessToken: account.accessToken,
      extraConfig: account.extraConfig as Record<string, unknown>,
      webhookVerifyToken: account.webhookVerifyToken,
    });

    if (challenge === false) throw new UnauthorizedException('Token inválido');
    return challenge;
  }

  async handleEvent(
    channelType: ChannelType,
    externalId: string,
    payload: unknown,
    rawBody: Buffer,
    signature?: string,
  ) {
    const account = await this.prisma.channelAccount.findUnique({
      where: { channelType_externalId: { channelType, externalId } },
    });
    if (!account) return;

    // Verificar firma HMAC si el canal la usa
    const secret = process.env.META_APP_SECRET;
    if (secret && signature) {
      const channel = this.channelRegistry.get(channelType);
      const valid = channel.verifySignature(rawBody, signature, secret);
      if (!valid) {
        this.logger.warn(`Firma HMAC inválida para ${channelType}/${externalId}`);
        return;
      }
    }

    const channel = this.channelRegistry.get(channelType);
    const messages = channel.parseIncomingWebhook(payload);
    if (!messages?.length) return;

    // Encolar cada mensaje como job independiente
    // jobId = externalId garantiza deduplicación a nivel de cola
    const jobs = messages.map((msg) => ({
      name: JOBS.PROCESS_MESSAGE,
      data: {
        channelAccountId: account.id,
        channelType,
        msg,
      } satisfies IncomingMessageJobData,
      opts: {
        jobId: `${account.id}:${msg.externalId}`,
      },
    }));

    await this.incomingQueue.addBulk(jobs);

    this.logger.debug(
      `Encolados ${jobs.length} mensaje(s) de ${channelType}/${externalId}`,
    );
  }
}
