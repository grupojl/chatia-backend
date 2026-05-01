// src/langgraph/langgraph.types.ts
import { ConversationStage } from '@prisma/client';

// ─── Estado del grafo ─────────────────────────────────────────────────────────

export interface GraphState {
  // Contexto de la conversación
  conversationId: string;
  channelAccountId: string;
  organizationId: string;

  // Mensaje entrante actual
  incomingMessage: string;
  senderExternalId: string;

  // Historial reciente (últimos N mensajes)
  history: Array<{ role: 'user' | 'assistant'; content: string }>;

  // Resultado de classify
  intent: string | null;
  entities: Record<string, string>; // { budget, zone, property_type, bedrooms, ... }
  shouldEscalate: boolean;

  // Resultado de generate
  responseText: string | null;
  tokensUsed: number;
  modelUsed: string | null;

  // Stage actualizado
  currentStage: ConversationStage;
  nextStage: ConversationStage | null;

  // Config de IA
  systemPrompt: string;
  personaName: string;
  groqModel: string;
  temperature: number;
  maxTokens: number;
  humanTakeoverKeywords: string[];

  // Errores
  error: string | null;
}

// ─── Tipos de intent ──────────────────────────────────────────────────────────

export const INTENTS = {
  GREETING: 'greeting',
  PROPERTY_SEARCH: 'property_search',
  PRICE_INQUIRY: 'price_inquiry',
  VISIT_REQUEST: 'visit_request',
  NEGOTIATION: 'negotiation',
  COMPLAINT: 'complaint',
  FAREWELL: 'farewell',
  HUMAN_REQUEST: 'human_request',
  OTHER: 'other',
} as const;

export type Intent = (typeof INTENTS)[keyof typeof INTENTS];

// ─── Resultado de clasificación ───────────────────────────────────────────────

export interface ClassifyResult {
  intent: Intent;
  entities: Record<string, string>;
  shouldEscalate: boolean;
  nextStage: ConversationStage | null;
  confidence: number;
}