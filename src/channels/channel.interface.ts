// src/channels/channel.interface.ts

export interface IncomingMessage {
  /** ID único del mensaje en el canal externo */
  externalId: string;
  /** ID del usuario/sender en el canal */
  senderExternalId: string;
  /** Nombre del sender si el canal lo provee */
  senderName?: string;
  /** Avatar URL si el canal lo provee */
  senderAvatarUrl?: string;
  /** Username (Instagram handle, TikTok username) */
  senderUsername?: string;
  /** Número de teléfono (solo WhatsApp) */
  senderPhone?: string;
  /** Tipo de contenido */
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location';
  /** Contenido textual o caption */
  content: string;
  /** URL del media si aplica */
  mediaUrl?: string;
  /** Timestamp del mensaje */
  timestamp: Date;
  /** Metadata extra del canal */
  raw: Record<string, unknown>;
}

export interface OutgoingMessage {
  to: string; // externalId del destinatario
  type: 'text' | 'image' | 'template';
  content: string;
  mediaUrl?: string;
}

export interface IChannel {
  /**
   * Parsea el payload entrante del webhook y devuelve mensajes normalizados.
   * Devuelve null si el payload no contiene mensajes (ej: status updates).
   */
  parseIncomingWebhook(payload: unknown): IncomingMessage[] | null;

  /**
   * Verifica la solicitud de verificación del webhook del canal.
   * Devuelve el challenge string si es válido, false si no.
   */
  verifyWebhook(query: Record<string, string>, accountConfig: ChannelAccountConfig): string | false;

  /**
   * Envía un mensaje a través del canal.
   */
  sendMessage(msg: OutgoingMessage, accountConfig: ChannelAccountConfig): Promise<void>;

  /**
   * Verifica la firma HMAC del webhook (seguridad).
   * Devuelve true si la firma es válida.
   */
  verifySignature(rawBody: Buffer, signature: string, secret: string): boolean;
}

export interface ChannelAccountConfig {
  externalId: string;
  accessToken: string;
  extraConfig: Record<string, unknown>;
  webhookVerifyToken: string;
}