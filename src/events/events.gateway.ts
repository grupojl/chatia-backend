// src/events/events.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('join:organization')
  handleJoinOrg(
    @MessageBody() organizationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`org:${organizationId}`);
    this.logger.debug(`Cliente ${client.id} unido a org:${organizationId}`);
    return { status: 'joined', room: `org:${organizationId}` };
  }

  @SubscribeMessage('join:conversation')
  handleJoinConv(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`conv:${conversationId}`);
    return { status: 'joined', room: `conv:${conversationId}` };
  }

  @SubscribeMessage('leave:conversation')
  handleLeaveConv(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`conv:${conversationId}`);
    return { status: 'left' };
  }

  @SubscribeMessage('join:agent')
  handleJoinAgent(
    @MessageBody() agentId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`agent:${agentId}`);
    this.logger.debug(`Cliente ${client.id} unido a agent:${agentId}`);
    return { status: 'joined', room: `agent:${agentId}` };
  }

  // ── Métodos que llaman los services ──────────────────────────────────────

  emitNewMessage(organizationId: string, conversationId: string, message: unknown) {
    this.server.to(`conv:${conversationId}`).emit('message:new', message);
    this.server.to(`org:${organizationId}`).emit('conversation:updated', {
      conversationId,
      event: 'new_message',
    });
  }

  emitConversationUpdated(organizationId: string, conversation: unknown) {
    this.server.to(`org:${organizationId}`).emit('conversation:updated', conversation);
  }

  emitEscalation(organizationId: string, conversationId: string) {
    this.server.to(`org:${organizationId}`).emit('conversation:escalated', {
      conversationId,
    });
  }

  emitToAgent(agentId: string, event: string, data: unknown) {
    this.server.to(`agent:${agentId}`).emit(event, data);
  }

  /** Notifica al front que un mensaje falló definitivamente tras los reintentos */
  emitMessageFailed(organizationId: string, conversationId: string, messageId: string) {
    this.server.to(`conv:${conversationId}`).emit('message:failed', { messageId });
    this.server.to(`org:${organizationId}`).emit('message:failed', {
      conversationId,
      messageId,
    });
  }
}
