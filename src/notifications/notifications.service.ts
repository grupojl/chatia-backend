// src/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationType } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface CreateNotificationInput {
  organizationId: string;
  agentId: string;
  conversationId?: string;
  type: NotificationType;
  title: string;
  body: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  // ── Crear notificación y emitir por WebSocket ─────────────────────────────

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        agentId: input.agentId,
        conversationId: input.conversationId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
      },
    });

    // Emitir en tiempo real al agente específico
    this.events.emitToAgent(input.agentId, 'notification:new', notification);

    this.logger.debug(
      `Notificación ${input.type} creada para agente ${input.agentId}`,
    );

    return notification;
  }

  // ── Helpers para cada tipo de evento ─────────────────────────────────────

  async notifyNewConversation(
    organizationId: string,
    agentId: string,
    conversationId: string,
    contactName: string,
  ) {
    return this.create({
      organizationId,
      agentId,
      conversationId,
      type: NotificationType.NEW_CONVERSATION,
      title: 'Nueva conversación asignada',
      body: `${contactName ?? 'Un contacto'} inició una conversación`,
    });
  }

  async notifyNewMessage(
    organizationId: string,
    agentId: string,
    conversationId: string,
    contactName: string,
    messagePreview: string,
  ) {
    return this.create({
      organizationId,
      agentId,
      conversationId,
      type: NotificationType.NEW_MESSAGE,
      title: `Mensaje de ${contactName ?? 'contacto'}`,
      body: messagePreview.slice(0, 100),
    });
  }

  async notifyEscalation(
    organizationId: string,
    agentId: string,
    conversationId: string,
    contactName: string,
  ) {
    return this.create({
      organizationId,
      agentId,
      conversationId,
      type: NotificationType.ESCALATION,
      title: '⚠️ Escalación — se requiere atención humana',
      body: `${contactName ?? 'Un contacto'} necesita hablar con un agente`,
    });
  }

  // ── Listado ───────────────────────────────────────────────────────────────

  async list(agentId: string, onlyUnread = false, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: any = {
      agentId,
      ...(onlyUnread && { isRead: false }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { agentId, isRead: false } }),
    ]);

    return {
      success: true,
      data: notifications,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // ── Marcar como leída ─────────────────────────────────────────────────────

  async markRead(notificationId: string, agentId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, agentId },
      data: { isRead: true },
    });
    return { success: true, updated: updated.count };
  }

  async markAllRead(agentId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { agentId, isRead: false },
      data: { isRead: true },
    });
    return { success: true, updated: updated.count };
  }
}
