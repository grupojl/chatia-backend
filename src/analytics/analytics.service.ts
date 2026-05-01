// src/analytics/analytics.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Overview general ─────────────────────────────────────────────────────

  async getOverview(organizationId: string, from: Date, to: Date) {
    const accountIds = await this.getAccountIds(organizationId);

    const [
      conversationsByStatus,
      conversationsByChannel,
      totalConversations,
      resolvedConversations,
      escalatedConversations,
      messageStats,
      newContacts,
      topTags,
      avgResponseTime,
    ] = await Promise.all([
      // Conversaciones por status
      this.prisma.conversation.groupBy({
        by: ['status'],
        where: {
          channelAccountId: { in: accountIds },
          createdAt: { gte: from, lte: to },
        },
        _count: { id: true },
      }),

      // Conversaciones por canal
      this.prisma.conversation.groupBy({
        by: ['channelAccountId'],
        where: {
          channelAccountId: { in: accountIds },
          createdAt: { gte: from, lte: to },
        },
        _count: { id: true },
      }),

      // Total conversaciones
      this.prisma.conversation.count({
        where: {
          channelAccountId: { in: accountIds },
          createdAt: { gte: from, lte: to },
        },
      }),

      // Resueltas
      this.prisma.conversation.count({
        where: {
          channelAccountId: { in: accountIds },
          createdAt: { gte: from, lte: to },
          status: 'RESOLVED',
        },
      }),

      // Escaladas a humano
      this.prisma.conversation.count({
        where: {
          channelAccountId: { in: accountIds },
          createdAt: { gte: from, lte: to },
          status: 'HUMAN_TAKEOVER',
        },
      }),

      // Mensajes: total, IA, humano
      this.getMessageStats(accountIds, from, to),

      // Contactos nuevos en el período
      this.prisma.contact.count({
        where: {
          organizationId,
          firstSeenAt: { gte: from, lte: to },
        },
      }),

      // Top 10 tags más usados
      this.getTopTags(accountIds, from, to),

      // Tiempo promedio de primera respuesta (en minutos)
      this.getAvgFirstResponseTime(accountIds, from, to),
    ]);

    // Enriquecer conversaciones por canal con nombre del canal
    const accounts = await this.prisma.channelAccount.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, name: true, channelType: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const byChannel = conversationsByChannel.map((row) => ({
      channelAccountId: row.channelAccountId,
      channelName: accountMap.get(row.channelAccountId)?.name ?? 'Desconocido',
      channelType: accountMap.get(row.channelAccountId)?.channelType,
      count: row._count.id,
    }));

    return {
      success: true,
      data: {
        period: { from, to },
        conversations: {
          total: totalConversations,
          resolved: resolvedConversations,
          escalated: escalatedConversations,
          resolutionRate: totalConversations > 0
            ? Math.round((resolvedConversations / totalConversations) * 100)
            : 0,
          escalationRate: totalConversations > 0
            ? Math.round((escalatedConversations / totalConversations) * 100)
            : 0,
          byStatus: conversationsByStatus.reduce(
            (acc, row) => ({ ...acc, [row.status]: row._count.id }),
            {} as Record<string, number>,
          ),
          byChannel,
        },
        messages: messageStats,
        contacts: {
          newInPeriod: newContacts,
        },
        topTags,
        avgFirstResponseMinutes: avgResponseTime,
      },
    };
  }

  // ── Conversaciones por día ────────────────────────────────────────────────

  async getConversationsByDay(organizationId: string, from: Date, to: Date) {
    const accountIds = await this.getAccountIds(organizationId);

    // Usamos query raw para agrupar por día
    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; count: bigint }>
    >`
      SELECT
        DATE_TRUNC('day', "createdAt") AS day,
        COUNT(*) AS count
      FROM "Conversation"
      WHERE
        "channelAccountId" = ANY(${accountIds})
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY day ASC
    `;

    return {
      success: true,
      data: rows.map((r) => ({
        day: r.day,
        count: Number(r.count),
      })),
    };
  }

  // ── Métricas por agente ───────────────────────────────────────────────────

  async getAgentMetrics(organizationId: string, from: Date, to: Date) {
    const accountIds = await this.getAccountIds(organizationId);

    const agents = await this.prisma.agent.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, email: true },
    });

    const metrics = await Promise.all(
      agents.map(async (agent) => {
        const [total, resolved, escalated, avgResponse] = await Promise.all([
          this.prisma.conversation.count({
            where: {
              channelAccountId: { in: accountIds },
              assignedAgentId: agent.id,
              createdAt: { gte: from, lte: to },
            },
          }),
          this.prisma.conversation.count({
            where: {
              channelAccountId: { in: accountIds },
              assignedAgentId: agent.id,
              status: 'RESOLVED',
              createdAt: { gte: from, lte: to },
            },
          }),
          this.prisma.conversation.count({
            where: {
              channelAccountId: { in: accountIds },
              assignedAgentId: agent.id,
              status: 'HUMAN_TAKEOVER',
              createdAt: { gte: from, lte: to },
            },
          }),
          this.getAvgFirstResponseTime(accountIds, from, to, agent.id),
        ]);

        return {
          agentId: agent.id,
          name: agent.name,
          email: agent.email,
          conversations: total,
          resolved,
          escalated,
          resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
          avgFirstResponseMinutes: avgResponse,
        };
      }),
    );

    return { success: true, data: metrics };
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async getMessageStats(accountIds: string[], from: Date, to: Date) {
    const convIds = await this.prisma.conversation
      .findMany({
        where: { channelAccountId: { in: accountIds } },
        select: { id: true },
      })
      .then((rows) => rows.map((r) => r.id));

    if (!convIds.length) {
      return { total: 0, inbound: 0, outbound: 0, aiGenerated: 0, humanGenerated: 0, totalTokensUsed: 0 };
    }

    const [total, inbound, outbound, aiGenerated, tokensSum] = await Promise.all([
      this.prisma.message.count({
        where: { conversationId: { in: convIds }, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.message.count({
        where: { conversationId: { in: convIds }, direction: 'INBOUND', createdAt: { gte: from, lte: to } },
      }),
      this.prisma.message.count({
        where: { conversationId: { in: convIds }, direction: 'OUTBOUND', createdAt: { gte: from, lte: to } },
      }),
      this.prisma.message.count({
        where: { conversationId: { in: convIds }, isAiGenerated: true, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.message.aggregate({
        where: { conversationId: { in: convIds }, createdAt: { gte: from, lte: to } },
        _sum: { tokensUsed: true },
      }),
    ]);

    return {
      total,
      inbound,
      outbound,
      aiGenerated,
      humanGenerated: outbound - aiGenerated,
      totalTokensUsed: tokensSum._sum.tokensUsed ?? 0,
    };
  }

  private async getTopTags(accountIds: string[], from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<
      Array<{ tag: string; count: bigint }>
    >`
      SELECT
        UNNEST("tags") AS tag,
        COUNT(*) AS count
      FROM "Conversation"
      WHERE
        "channelAccountId" = ANY(${accountIds})
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
        AND ARRAY_LENGTH("tags", 1) > 0
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 10
    `;

    return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
  }

  private async getAvgFirstResponseTime(
    accountIds: string[],
    from: Date,
    to: Date,
    agentId?: string,
  ): Promise<number> {
    // Tiempo entre el primer mensaje INBOUND y el primer mensaje OUTBOUND
    // de cada conversación, en minutos
    const rows = await this.prisma.$queryRaw<
      Array<{ avg_minutes: number }>
    >`
      SELECT
        AVG(
          EXTRACT(EPOCH FROM (first_out.createdAt - first_in.createdAt)) / 60
        ) AS avg_minutes
      FROM (
        SELECT
          c.id,
          MIN(m_in."createdAt") AS createdAt
        FROM "Conversation" c
        JOIN "Message" m_in ON m_in."conversationId" = c.id
          AND m_in.direction = 'INBOUND'
        WHERE
          c."channelAccountId" = ANY(${accountIds})
          AND c."createdAt" >= ${from}
          AND c."createdAt" <= ${to}
          ${agentId ? this.prisma.$queryRaw`AND c."assignedAgentId" = ${agentId}` : this.prisma.$queryRaw``}
        GROUP BY c.id
      ) first_in
      JOIN (
        SELECT
          "conversationId",
          MIN("createdAt") AS createdAt
        FROM "Message"
        WHERE direction = 'OUTBOUND'
        GROUP BY "conversationId"
      ) first_out ON first_out."conversationId" = first_in.id
      WHERE first_out.createdAt > first_in.createdAt
    `;

    return Math.round(rows[0]?.avg_minutes ?? 0);
  }

  private async getAccountIds(organizationId: string): Promise<string[]> {
    const accounts = await this.prisma.channelAccount.findMany({
      where: { organizationId },
      select: { id: true },
    });
    return accounts.map((a) => a.id);
  }
}
