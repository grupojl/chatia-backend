// src/assistant/chat/assistant-chat.service.ts
import { Injectable, Logger, Optional } from '@nestjs/common';
import { GroqService, GroqMessage } from '../../groq/groq.service';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { AssistantConfigService } from '../config/assistant-config.service';
import { AssistantSessionService } from '../session/assistant-session.service';

// Importación lazy para evitar dependencia circular — FaqModule exporta RagService
export type RagServiceLike = {
  answer(kbId: string, question: string, options?: object): Promise<{ answer: string; sources: unknown[] }>;
};

export interface ChatInput {
  projectSlug: string;
  organizationId: string;
  userId: string;
  message: string;
  channel?: string;
}

export interface ChatOutput {
  sessionId: string;
  response: string;
  tokensUsed: number;
  modelUsed: string;
  usedFaqFallback: boolean;
  faqSources?: unknown[];
}

export const RAG_SERVICE_TOKEN = 'RAG_SERVICE';

@Injectable()
export class AssistantChatService {
  private readonly logger = new Logger(AssistantChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly groq: GroqService,
    private readonly events: EventsGateway,
    private readonly configService: AssistantConfigService,
    private readonly sessionService: AssistantSessionService,
    @Optional() private readonly ragService?: RagServiceLike,
  ) {}

  async chat(input: ChatInput): Promise<ChatOutput> {
    const { projectSlug, organizationId, userId, message, channel = 'api' } = input;

    const config = await this.configService.findByProjectSlug(projectSlug, organizationId);

    if (!config.isEnabled) {
      return {
        sessionId: '',
        response: config.fallbackMessage ?? 'El asistente no está disponible.',
        tokensUsed: 0, modelUsed: '', usedFaqFallback: false,
      };
    }

    const session = await this.sessionService.getOrCreate(config.id, organizationId, userId, channel);
    await this.sessionService.appendMessage(session.id, 'user', message);
    this.events.emitToAgent(organizationId, 'assistant:typing', { sessionId: session.id, userId });

    const history = await this.sessionService.getHistory(session.id, config.contextWindow);

    const messages: GroqMessage[] = [
      { role: 'system', content: this.buildSystemPrompt(config) },
      ...history.slice(0, -1).map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: message },
    ];

    let responseText: string;
    let tokensUsed = 0;
    let modelUsed = config.groqModel;
    let usedFaqFallback = false;
    let faqSources: unknown[] | undefined;

    try {
      const result = await this.groq.chat(messages, {
        model: config.groqModel as any,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

      responseText = result.content;
      tokensUsed = result.tokensUsed;
      modelUsed = result.model;

      // FAQ fallback con RAG real si está configurado y la confianza es baja
      if (config.useFaqFallback && config.faqKbId && this.isLowConfidence(responseText) && this.ragService) {
        this.logger.debug(`[session:${session.id}] Activando RAG fallback — KB: ${config.faqKbId}`);
        try {
          const ragResult = await this.ragService.answer(config.faqKbId, message, {
            groqModel: config.groqModel,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
          });
          responseText = ragResult.answer;
          faqSources = ragResult.sources;
          usedFaqFallback = true;
        } catch (ragErr) {
          this.logger.warn(`RAG fallback falló: ${ragErr}`);
        }
      }
    } catch (err) {
      this.logger.error(`Error en Groq: ${err}`);
      responseText = config.fallbackMessage ?? '¡Disculpá! Tuve un problema. ¿Podés repetir tu consulta?';
    }

    await this.sessionService.appendMessage(session.id, 'assistant', responseText);
    this.events.emitToAgent(organizationId, 'assistant:message', {
      sessionId: session.id, userId, message: responseText, usedFaqFallback,
    });

    return { sessionId: session.id, response: responseText, tokensUsed, modelUsed, usedFaqFallback, faqSources };
  }

  private buildSystemPrompt(config: { systemPrompt: string; personaName: string }): string {
    const base = config.systemPrompt || 'Sos un asistente virtual amigable.';
    return `${base}\n\nTu nombre es ${config.personaName}. Respondé siempre en español, de forma conversacional y breve.`;
  }

  private isLowConfidence(response: string): boolean {
    const keywords = [
      'no sé', 'no tengo información', 'no tengo esa información',
      'no puedo responder', 'no estoy seguro', 'no lo sé',
      'no tengo datos', 'no tengo acceso',
    ];
    return keywords.some((kw) => response.toLowerCase().includes(kw));
  }
}
