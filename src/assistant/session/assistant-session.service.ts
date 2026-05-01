// src/assistant/session/assistant-session.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

@Injectable()
export class AssistantSessionService {
  private readonly logger = new Logger(AssistantSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(
    assistantConfigId: string,
    organizationId: string,
    externalUserId: string,
    channel: string,
  ) {
    const existing = await this.prisma.assistantSession.findFirst({
      where: { assistantConfigId, organizationId, externalUserId, channel },
    });
    if (existing) return existing;

    const created = await this.prisma.assistantSession.create({
      data: {
        assistantConfigId, organizationId, externalUserId, channel,
        history: [], metadata: {},
      },
    });
    this.logger.debug(`Nueva sesión: ${created.id} — usuario: ${externalUserId}`);
    return created;
  }

  async appendMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
    const session = await this.prisma.assistantSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    const history = (session.history as unknown as SessionMessage[]) ?? [];
    const newMsg: SessionMessage = { role, content, createdAt: new Date().toISOString() };

    await this.prisma.assistantSession.update({
      where: { id: sessionId },
      data: { history: JSON.parse(JSON.stringify([...history, newMsg])), lastMessageAt: new Date() },
    });
    return newMsg;
  }

  async getHistory(sessionId: string, limit = 10): Promise<SessionMessage[]> {
    const session = await this.prisma.assistantSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    const history = (session.history as unknown as SessionMessage[]) ?? [];
    return history.slice(-limit);
  }

  async resetSession(sessionId: string) {
    await this.prisma.assistantSession.update({
      where: { id: sessionId },
      data: { history: [], lastMessageAt: null },
    });
    this.logger.log(`Sesión reseteada: ${sessionId}`);
  }

  async findByUser(assistantConfigId: string, organizationId: string, externalUserId: string) {
    return this.prisma.assistantSession.findFirst({
      where: { assistantConfigId, organizationId, externalUserId },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async deleteByUser(assistantConfigId: string, organizationId: string, externalUserId: string) {
    const session = await this.findByUser(assistantConfigId, organizationId, externalUserId);
    if (!session) return null;
    await this.prisma.assistantSession.delete({ where: { id: session.id } });
    return session;
  }
}
