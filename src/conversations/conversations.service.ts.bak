// src/conversations/conversations.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { LangGraphEngine } from '../langgraph/langgraph.engine';
import { ChannelRegistry } from '../channels/channel.registry';
import { IncomingMessage } from '../channels/channel.interface';
import {
  ChannelType,
  ConversationStatus,
  MessageDirection,
  MessageType,
  MessageStatus,
} from '@prisma/client';
import { AssistantChatService } from '../assistant/chat/assistant-chat.service';
import { EventsGateway } from '../events/events.gateway';
import { AssignmentService } from '../assignment/assignment.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QUEUES, JOBS } from '../queue/queue.constants';
import type { OutgoingMessageJobData } from '../queue/processors/outgoing-message.processor';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly langGraph: LangGraphEngine,
    private readonly channelRegistry: ChannelRegistry,
    private readonly events: EventsGateway,
    private readonly assignment: AssignmentService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.OUTGOING_MESSAGE)
    private readonly outgoingQueue: Queue<OutgoingMessageJobData>,
    @Optional() private readonly assistantChat?: AssistantChatService,
  ) {}

  // ── Procesamiento de mensaje entrante ────────────────────────────────────

  async handleIncomingMessage(
    channelAccountId: string,
    channelType: ChannelType,
    msg: IncomingMessage,
  ): Promise<void> {
    const account = await this.prisma.channelAccount.findUnique({
      where: { id: channelAccountId },
      include: { aiConfig: true },
    });

    if (!account) {
      this.logger.warn(`ChannelAccount no encontrada: ${channelAccountId}`);
      return;
    }

    const contact = await this.upsertContact(account.organizationId, channelType, msg);
    const { conversation, isNew } = await this.getOrCreateConversation(
      channelAccountId,
      contact.id,
      account.organizationId,
      contact.name ?? msg.senderExternalId,
    );

    const existingMsg = await this.prisma.message.findUnique({
      where: {
        conversationId_externalId: {
          conversationId: conversation.id,
          externalId: msg.externalId,
        },
      },
    });

    if (existingMsg) {
      this.logger.debug(`Mensaje duplicado ignorado: ${msg.externalId}`);
      return;
    }

    const savedMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        type: msg.type.toUpperCase() as MessageType,
        content: msg.content,
        mediaUrl: msg.mediaUrl,
        externalId: msg.externalId,
      },
    });

    this.events.emitNewMessage(account.organizationId, conversation.id, savedMessage);

    await Promise.all([
      this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      }),
      this.prisma.contact.update({
        where: { id: contact.id },
        data: { lastSeenAt: new Date() },
      }),
    ]);

    if (!isNew && conversation.assignedAgentId) {
      await this.notifications.notifyNewMessage(
        account.organizationId,
        conversation.assignedAgentId,
        conversation.id,
        contact.name ?? msg.senderExternalId,
        msg.content,
      );
    }

    const aiConfig = account.aiConfig;
    const aiActive =
      aiConfig?.isEnabled &&
      conversation.isAiActive &&
      conversation.status !== 'HUMAN_TAKEOVER' &&
      conversation.status !== 'RESOLVED';

    if (!aiActive) {
      this.logger.debug(`IA inactiva para conversación ${conversation.id}`);
      return;
    }

    if (conversation.stage === 'INITIAL' && aiConfig?.welcomeMessage) {
      const count = await this.prisma.message.count({
        where: { conversationId: conversation.id, direction: 'INBOUND' },
      });
      if (count === 1) {
        await this.sendAndSave(
          conversation.id,
          channelAccountId,
          channelType,
          msg.senderExternalId,
          aiConfig.welcomeMessage,
          account.accessToken,
          account.extraConfig as Record<string, unknown>,
          account.webhookVerifyToken,
          account.organizationId,
        );
      }
    }

    // Sprint 5: si el canal tiene projectId, usar AssistantChatService
    if ((account as any).projectId && this.assistantChat) {
      const chatResult = await this.assistantChat.chat({
        projectSlug: (account as any).projectId,
        organizationId: account.organizationId,
        userId: msg.senderExternalId,
        message: msg.content,
        channel: channelType.toLowerCase(),
      });
      await this.sendAndSave(
        conversation.id, channelAccountId, channelType,
        msg.senderExternalId, chatResult.response,
        account.accessToken, account.extraConfig as Record<string, unknown>,
        account.webhookVerifyToken, account.organizationId,
        true, chatResult.tokensUsed, chatResult.modelUsed,
      );
      return;
    }

    const stateResult = await this.langGraph.run({
      conversationId: conversation.id,
      channelAccountId,
      organizationId: account.organizationId,
      incomingMessage: msg.content,
      senderExternalId: msg.senderExternalId,
      systemPrompt: aiConfig?.systemPrompt ?? '',
      personaName: aiConfig?.personaName ?? 'Asistente',
      groqModel: aiConfig?.groqModel ?? 'llama-3.3-70b-versatile',
      temperature: aiConfig?.temperature ?? 0.7,
      maxTokens: aiConfig?.maxTokens ?? 1024,
      contextWindowSize: aiConfig?.contextWindowSize ?? 10,
      humanTakeoverKeywords: aiConfig?.humanTakeoverKeywords ?? [],
      currentStage: conversation.stage,
      entities: (conversation.extractedEntities as Record<string, string>) ?? {},
    });

    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        stage: stateResult.nextStage,
        detectedIntent: stateResult.intent,
        extractedEntities: stateResult.entities,
        ...(stateResult.shouldEscalate && {
          status: ConversationStatus.HUMAN_TAKEOVER,
          isAiActive: false,
        }),
      },
    });

    if (stateResult.shouldEscalate) {
      this.events.emitEscalation(account.organizationId, conversation.id);
      if (conversation.assignedAgentId) {
        await this.notifications.notifyEscalation(
          account.organizationId,
          conversation.assignedAgentId,
          conversation.id,
          contact.name ?? msg.senderExternalId,
        );
      }
    }

    this.events.emitConversationUpdated(account.organizationId, updatedConversation);

    await this.sendAndSave(
      conversation.id,
      channelAccountId,
      channelType,
      msg.senderExternalId,
      stateResult.responseText,
      account.accessToken,
      account.extraConfig as Record<string, unknown>,
      account.webhookVerifyToken,
      account.organizationId,
      true,
      stateResult.tokensUsed,
      stateResult.modelUsed,
    );
  }

  // ── Listado y detalle ─────────────────────────────────────────────────────

  async list(
    organizationId: string,
    filters: {
      status?: ConversationStatus;
      channelAccountId?: string;
      tag?: string;
      archived?: boolean;
      page?: number;
    },
  ) {
    const page = filters.page ?? 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const accountIds = await this.getAccountIds(organizationId, filters.channelAccountId);

    const where: any = {
      channelAccountId: { in: accountIds },
      ...(filters.status && { status: filters.status }),
      ...(filters.tag && { tags: { has: filters.tag } }),
      // Por defecto ocultar archivadas; con ?archived=true mostrar solo archivadas
      ...(filters.archived
        ? { deletedAt: { not: null } }
        : { deletedAt: null }),
    };

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          contact: {
            select: { name: true, externalId: true, channelType: true, avatarUrl: true },
          },
          channelAccount: { select: { name: true, channelType: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      success: true,
      data: conversations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(conversationId: string, organizationId: string) {
    const accountIds = await this.getAccountIds(organizationId);

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, channelAccountId: { in: accountIds } },
      include: {
        contact: true,
        channelAccount: { select: { name: true, channelType: true } },
        messages: { orderBy: { createdAt: 'asc' }, take: 50 },
        agentState: true,
      },
    });

    if (!conversation) throw new NotFoundException('Conversación no encontrada');
    return { success: true, data: conversation };
  }

  async sendManualMessage(conversationId: string, organizationId: string, text: string) {
    const accountIds = await this.getAccountIds(organizationId);
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, channelAccountId: { in: accountIds } },
      include: { contact: true, channelAccount: true },
    });

    if (!conversation) throw new NotFoundException('Conversación no encontrada');
    if (conversation.status === 'RESOLVED') throw new BadRequestException('Conversación resuelta');
    if (conversation.deletedAt) throw new BadRequestException('Conversación archivada');

    const account = conversation.channelAccount;
    await this.sendAndSave(
      conversationId,
      account.id,
      account.channelType,
      conversation.contact.externalId,
      text,
      account.accessToken,
      account.extraConfig as Record<string, unknown>,
      account.webhookVerifyToken,
      organizationId,
    );

    return { success: true };
  }

  async takeover(conversationId: string, organizationId: string, agentId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.HUMAN_TAKEOVER,
        isAiActive: false,
        assignedAgentId: agentId,
        stage: 'HUMAN',
      },
    });
    this.events.emitEscalation(organizationId, conversationId);
    this.events.emitConversationUpdated(organizationId, updated);
    return { success: true, data: updated };
  }

  async release(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.OPEN,
        isAiActive: true,
        assignedAgentId: null,
      },
    });
    this.events.emitConversationUpdated(organizationId, updated);
    return { success: true, data: updated };
  }

  async resolve(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.RESOLVED,
        isAiActive: false,
        resolvedAt: new Date(),
      },
    });
    this.events.emitConversationUpdated(organizationId, updated);
    return { success: true, data: updated };
  }

  // ── Soft delete ───────────────────────────────────────────────────────────

  async softDelete(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        deletedAt: new Date(),
        isAiActive: false,
      },
    });
    this.events.emitConversationUpdated(organizationId, updated);
    return { success: true, message: 'Conversación archivada', data: updated };
  }

  async restore(conversationId: string, organizationId: string) {
    const accountIds = await this.getAccountIds(organizationId);
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, channelAccountId: { in: accountIds } },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    if (!conv.deletedAt) throw new BadRequestException('La conversación no está archivada');

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { deletedAt: null },
    });
    this.events.emitConversationUpdated(organizationId, updated);
    return { success: true, message: 'Conversación restaurada', data: updated };
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  async addTag(conversationId: string, organizationId: string, tag: string) {
    const conversation = await this.verifyOwnership(conversationId, organizationId);
    const normalized = tag.trim().toLowerCase();

    if (conversation.tags.includes(normalized)) {
      return { success: true, data: conversation };
    }

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { tags: { push: normalized } },
    });

    this.events.emitConversationUpdated(organizationId, updated);
    return { success: true, data: updated };
  }

  async removeTag(conversationId: string, organizationId: string, tag: string) {
    const conversation = await this.verifyOwnership(conversationId, organizationId);
    const normalized = tag.trim().toLowerCase();
    const updatedTags = conversation.tags.filter((t) => t !== normalized);

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { tags: updatedTags },
    });

    this.events.emitConversationUpdated(organizationId, updated);
    return { success: true, data: updated };
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async upsertContact(
    organizationId: string,
    channelType: ChannelType,
    msg: IncomingMessage,
  ) {
    return this.prisma.contact.upsert({
      where: {
        organizationId_channelType_externalId: {
          organizationId,
          channelType,
          externalId: msg.senderExternalId,
        },
      },
      create: {
        organizationId,
        channelType,
        externalId: msg.senderExternalId,
        name: msg.senderName,
        avatarUrl: msg.senderAvatarUrl,
        phone: msg.senderPhone,
        username: msg.senderUsername,
      },
      update: {
        ...(msg.senderName && { name: msg.senderName }),
        ...(msg.senderAvatarUrl && { avatarUrl: msg.senderAvatarUrl }),
        lastSeenAt: new Date(),
      },
    });
  }

  private async getOrCreateConversation(
    channelAccountId: string,
    contactId: string,
    organizationId: string,
    contactName: string,
  ): Promise<{ conversation: any; isNew: boolean }> {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        channelAccountId,
        contactId,
        status: { in: ['OPEN', 'HUMAN_TAKEOVER'] },
        deletedAt: null,
      },
    });

    if (existing) return { conversation: existing, isNew: false };

    const agentId = await this.assignment.assignAgent(organizationId, 'least-load');

    const conversation = await this.prisma.conversation.create({
      data: {
        channelAccountId,
        contactId,
        ...(agentId && { assignedAgentId: agentId }),
      },
    });

    this.events.emitConversationUpdated(organizationId, conversation);

    if (agentId) {
      await this.notifications.notifyNewConversation(
        organizationId,
        agentId,
        conversation.id,
        contactName,
      );
    }

    return { conversation, isNew: true };
  }

  private async sendAndSave(
    conversationId: string,
    channelAccountId: string,
    channelType: ChannelType,
    recipientExternalId: string,
    text: string,
    accessToken: string,
    extraConfig: Record<string, unknown>,
    webhookVerifyToken: string,
    organizationId: string,
    isAiGenerated = false,
    tokensUsed?: number,
    modelUsed?: string,
  ) {
    const account = await this.prisma.channelAccount.findUnique({
      where: { id: channelAccountId },
    });
    if (!account) return;

    const outboundMsg = await this.prisma.message.create({
      data: {
        conversationId,
        direction: MessageDirection.OUTBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.PENDING,
        content: text,
        isAiGenerated,
        tokensUsed,
        modelUsed,
      },
    });

    this.events.emitNewMessage(organizationId, conversationId, outboundMsg);

    await this.outgoingQueue.add(
      JOBS.SEND_MESSAGE,
      {
        messageId: outboundMsg.id,
        conversationId,
        organizationId,
        channelType,
        recipientExternalId,
        text,
        accessToken,
        externalId: account.externalId,
        extraConfig,
        webhookVerifyToken,
      } satisfies OutgoingMessageJobData,
      { jobId: `send:${outboundMsg.id}` },
    );

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
  }

  private async getAccountIds(organizationId: string, specificId?: string): Promise<string[]> {
    if (specificId) {
      const account = await this.prisma.channelAccount.findFirst({
        where: { id: specificId, organizationId },
      });
      return account ? [account.id] : [];
    }

    const accounts = await this.prisma.channelAccount.findMany({
      where: { organizationId },
      select: { id: true },
    });
    return accounts.map((a) => a.id);
  }

  private async verifyOwnership(conversationId: string, organizationId: string) {
    const accountIds = await this.getAccountIds(organizationId);
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, channelAccountId: { in: accountIds } },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv;
  }
}
