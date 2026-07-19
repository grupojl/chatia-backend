// =============================================================================
// modules/welver/welver.config.ts
// Configuración base del asistente para el proyecto WELVER.
// TODO: ajustar systemPrompt, stage y comportamiento cuando se integre el proyecto.
// =============================================================================

import { ConversationStage } from '@prisma/client';

export const WELVER_CONFIG = {
  /**
   * Prompt base del sistema para WELVER.
   * TODO: definir la persona, tono y reglas de negocio específicas.
   */
  systemPrompt: `
    Eres un asistente de WELVER.
    TODO: completar con las instrucciones específicas del proyecto.
  `.trim(),

  /**
   * Stage inicial de las conversaciones de WELVER.
   * TODO: ajustar según el flujo de negocio del proyecto.
   */
  defaultStage: ConversationStage.INITIAL,

  /**
   * Modelo LLM preferido para WELVER.
   * Puede sobrescribirse desde AssistantConfig en DB.
   */
  preferredModel: 'llama-3.3-70b-versatile',

  /**
   * Si este proyecto usa FAQ/RAG como fuente de conocimiento.
   * TODO: activar cuando se configure la KnowledgeBase del proyecto.
   */
  useFaqFallback: false,
} as const;
