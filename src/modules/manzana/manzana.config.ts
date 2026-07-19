// =============================================================================
// modules/manzana/manzana.config.ts
// Configuración base del asistente para el proyecto MANZANA.
// TODO: ajustar systemPrompt, stage y comportamiento cuando se integre el proyecto.
// =============================================================================

import { ConversationStage } from '@prisma/client';

export const MANZANA_CONFIG = {
  /**
   * Prompt base del sistema para MANZANA.
   * TODO: definir la persona, tono y reglas de negocio específicas.
   */
  systemPrompt: `
    Eres un asistente de MANZANA.
    TODO: completar con las instrucciones específicas del proyecto.
  `.trim(),

  /**
   * Stage inicial de las conversaciones de MANZANA.
   * TODO: ajustar según el flujo de negocio del proyecto.
   */
  defaultStage: ConversationStage.INITIAL,

  /**
   * Modelo LLM preferido para MANZANA.
   * Puede sobrescribirse desde AssistantConfig en DB.
   */
  preferredModel: 'llama-3.3-70b-versatile',

  /**
   * Si este proyecto usa FAQ/RAG como fuente de conocimiento.
   * TODO: activar cuando se configure la KnowledgeBase del proyecto.
   */
  useFaqFallback: false,
} as const;
