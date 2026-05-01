// src/messages/messages.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listByConversation(
    conversationId: string,
    organizationId: string,
    page = 1,
    limit = 50,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        channelAccount: { organizationId },
      },
    });

    if (!conversation) throw new NotFoundException('Conversación no encontrada');

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      success: true,
      data: messages,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getStats(organizationId: string) {
    const accounts = await this.prisma.channelAccount.findMany({
      where: { organizationId },
      select: { id: true },
    });

    const accountIds = accounts.map((a) => a.id);

    const conversations = await this.prisma.conversation.findMany({
      where: { channelAccountId: { in: accountIds } },
      select: { id: true },
    });

    const conversationIds = conversations.map((c) => c.id);

    const [total, inbound, outbound, aiGenerated, tokensSum] = await Promise.all([
      this.prisma.message.count({ where: { conversationId: { in: conversationIds } } }),
      this.prisma.message.count({
        where: { conversationId: { in: conversationIds }, direction: 'INBOUND' },
      }),
      this.prisma.message.count({
        where: { conversationId: { in: conversationIds }, direction: 'OUTBOUND' },
      }),
      this.prisma.message.count({
        where: { conversationId: { in: conversationIds }, isAiGenerated: true },
      }),
      this.prisma.message.aggregate({
        where: { conversationId: { in: conversationIds } },
        _sum: { tokensUsed: true },
      }),
    ]);

    return {
      success: true,
      data: {
        total,
        inbound,
        outbound,
        aiGenerated,
        totalTokensUsed: tokensSum._sum.tokensUsed ?? 0,
      },
    };
  }
}
