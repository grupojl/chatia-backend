// src/langgraph/langgraph.engine.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroqService } from '../groq/groq.service';
import { GraphState } from './langgraph.types';
import {
  classifyNode,
  retrieveContextNode,
  generateNode,
  validateNode,
  humanTakeoverNode,
} from './nodes';
import { ConversationStage } from '@prisma/client';

export interface RunGraphInput {
  conversationId: string;
  channelAccountId: string;
  organizationId: string;
  incomingMessage: string;
  senderExternalId: string;
  systemPrompt: string;
  personaName: string;
  groqModel: string;
  temperature: number;
  maxTokens: number;
  contextWindowSize: number;
  humanTakeoverKeywords: string[];
  currentStage: ConversationStage;
  entities: Record<string, string>;
}

export interface RunGraphOutput {
  responseText: string;
  tokensUsed: number;
  modelUsed: string;
  nextStage: ConversationStage;
  shouldEscalate: boolean;
  intent: string;
  entities: Record<string, string>;
}

@Injectable()
export class LangGraphEngine {
  private readonly logger = new Logger(LangGraphEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly groq: GroqService,
  ) {}

  async run(input: RunGraphInput): Promise<RunGraphOutput> {
    // Cargar historial reciente
    const recentMessages = await this.prisma.message.findMany({
      where: { conversationId: input.conversationId },
      orderBy: { createdAt: 'desc' },
      take: input.contextWindowSize,
      select: { direction: true, content: true },
    });

    const history = recentMessages
      .reverse()
      .map(m => ({
        role: m.direction === 'INBOUND' ? 'user' as const : 'assistant' as const,
        content: m.content,
      }));

    // Estado inicial del grafo
    let state: GraphState = {
      conversationId: input.conversationId,
      channelAccountId: input.channelAccountId,
      organizationId: input.organizationId,
      incomingMessage: input.incomingMessage,
      senderExternalId: input.senderExternalId,
      history,
      intent: null,
      entities: input.entities,
      shouldEscalate: false,
      responseText: null,
      tokensUsed: 0,
      modelUsed: null,
      currentStage: input.currentStage,
      nextStage: null,
      systemPrompt: input.systemPrompt,
      personaName: input.personaName,
      groqModel: input.groqModel,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      humanTakeoverKeywords: input.humanTakeoverKeywords,
      error: null,
    };

    this.logger.debug(`[${input.conversationId}] Iniciando grafo — stage: ${state.currentStage}`);

    // ── Nodo 1: classify ──────────────────────────────────────────────────────
    const classified = await classifyNode(state, this.groq);
    state = { ...state, ...classified };
    this.logger.debug(`[${input.conversationId}] classify → intent: ${state.intent}, escalate: ${state.shouldEscalate}`);

    // ── Nodo 2: retrieve_context ──────────────────────────────────────────────
    const retrieved = retrieveContextNode(state);
    state = { ...state, ...retrieved };

    // ── Decisión: ¿escalar a humano? ──────────────────────────────────────────
    if (state.shouldEscalate) {
      const takeover = humanTakeoverNode(state);
      state = { ...state, ...takeover };
    } else {
      // ── Nodo 3: generate ────────────────────────────────────────────────────
      const generated = await generateNode(state, this.groq);
      state = { ...state, ...generated };

      // ── Nodo 4: validate ────────────────────────────────────────────────────
      const validated = await validateNode(state, this.groq);
      state = { ...state, ...validated };
    }

    this.logger.debug(`[${input.conversationId}] Grafo completo — stage final: ${state.currentStage}`);

    // Persistir el estado del agente
    await this.persistState(state);

    return {
      responseText: state.responseText ?? 'Disculpá, hubo un error. Por favor reintentá.',
      tokensUsed: state.tokensUsed,
      modelUsed: state.modelUsed ?? state.groqModel,
      nextStage: state.currentStage,
      shouldEscalate: state.shouldEscalate,
      intent: state.intent ?? 'other',
      entities: state.entities,
    };
  }

  private async persistState(state: GraphState): Promise<void> {
    await this.prisma.agentState.upsert({
      where: { conversationId: state.conversationId },
      create: {
        conversationId: state.conversationId,
        currentNode: state.shouldEscalate ? 'human_takeover' : 'respond',
        context: {
          intent: state.intent,
          entities: state.entities,
          stage: state.currentStage,
          lastError: state.error,
        },
      },
      update: {
        currentNode: state.shouldEscalate ? 'human_takeover' : 'respond',
        context: {
          intent: state.intent,
          entities: state.entities,
          stage: state.currentStage,
          lastError: state.error,
        },
      },
    });
  }
}