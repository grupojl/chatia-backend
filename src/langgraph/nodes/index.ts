// src/langgraph/nodes/index.ts
import { Logger } from '@nestjs/common';
import { GroqService, GROQ_MODELS } from '../../groq/groq.service';
import { GraphState, ClassifyResult, INTENTS } from '../langgraph.types';
import { ConversationStage } from '@prisma/client';

const logger = new Logger('LangGraphNodes');

// ─────────────────────────────────────────────────────────────────────────────
// NODO: classify
// Detecta intent, extrae entidades y decide si escalar.
// Usa Llama 8B (rápido) para reducir latencia.
// ─────────────────────────────────────────────────────────────────────────────

export async function classifyNode(
  state: GraphState,
  groq: GroqService,
): Promise<Partial<GraphState>> {
  const prompt = `Analizá este mensaje de un cliente y devolvé SOLO un JSON con esta estructura exacta:
{
  "intent": "<greeting|property_search|price_inquiry|visit_request|negotiation|complaint|farewell|human_request|other>",
  "entities": {
    "budget": "<monto si mencionó presupuesto, sino null>",
    "zone": "<zona/barrio si mencionó, sino null>",
    "property_type": "<casa|depto|local|oficina si mencionó, sino null>",
    "bedrooms": "<número si mencionó, sino null>"
  },
  "shouldEscalate": <true si pide hablar con humano, pregunta precio exacto, o quiere negociar condiciones>,
  "nextStage": "<QUALIFYING|INFORMED|NEGOTIATING|CLOSING|FOLLOW_UP|null>",
  "confidence": <0.0 a 1.0>
}

Stage actual: ${state.currentStage}
Historial reciente: ${state.history.slice(-3).map(h => `${h.role}: ${h.content}`).join('\n')}
Mensaje nuevo: "${state.incomingMessage}"

Keywords de escalado: ${state.humanTakeoverKeywords.join(', ')}`;

  try {
    const result = await groq.chatJson<ClassifyResult>([
      { role: 'user', content: prompt },
    ], {
      model: GROQ_MODELS.LLAMA_8B,
      temperature: 0.1,
      maxTokens: 256,
    });

    // Verificar si alguna keyword de takeover está en el mensaje
    const msgLower = state.incomingMessage.toLowerCase();
    const hasKeyword = state.humanTakeoverKeywords.some(kw =>
      msgLower.includes(kw.toLowerCase()),
    );

    return {
      intent: result.intent ?? INTENTS.OTHER,
      entities: { ...state.entities, ...result.entities },
      shouldEscalate: result.shouldEscalate || hasKeyword,
      nextStage: result.nextStage ?? null,
    };
  } catch (err) {
    logger.error('classifyNode error', err);
    return { intent: INTENTS.OTHER, shouldEscalate: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NODO: retrieve_context
// Actualiza el stage de la conversación en base al resultado de classify.
// ─────────────────────────────────────────────────────────────────────────────

export function retrieveContextNode(state: GraphState): Partial<GraphState> {
  // Si hay un nextStage sugerido por classify, aplicarlo
  const stageOrder: ConversationStage[] = [
    'INITIAL', 'QUALIFYING', 'INFORMED', 'NEGOTIATING', 'CLOSING', 'FOLLOW_UP', 'HUMAN',
  ];

  let currentStage = state.currentStage;

  if (state.nextStage) {
    const currentIdx = stageOrder.indexOf(state.currentStage);
    const nextIdx = stageOrder.indexOf(state.nextStage);
    // Solo avanzar hacia adelante en el ciclo (nunca retroceder excepto a HUMAN)
    if (nextIdx > currentIdx || state.nextStage === 'HUMAN') {
      currentStage = state.nextStage;
    }
  }

  return { currentStage };
}

// ─────────────────────────────────────────────────────────────────────────────
// NODO: generate
// Genera la respuesta usando el modelo configurado por el cliente.
// ─────────────────────────────────────────────────────────────────────────────

export async function generateNode(
  state: GraphState,
  groq: GroqService,
): Promise<Partial<GraphState>> {
  const systemPrompt = buildSystemPrompt(state);

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...state.history.map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: state.incomingMessage },
  ];

  try {
    const result = await groq.chat(messages, {
      model: state.groqModel as any,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
    });

    return {
      responseText: result.content,
      tokensUsed: result.tokensUsed,
      modelUsed: result.model,
      error: null,
    };
  } catch (err) {
    logger.error('generateNode error', err);
    return {
      responseText: '¡Disculpá! Tuve un problema técnico. ¿Podés repetir tu consulta?',
      error: String(err),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NODO: validate
// Filtra respuestas que comprometan precios, condiciones o sean incorrectas.
// ─────────────────────────────────────────────────────────────────────────────

export async function validateNode(
  state: GraphState,
  groq: GroqService,
): Promise<Partial<GraphState>> {
  if (!state.responseText) return {};

  const prompt = `Revisá esta respuesta de un asistente inmobiliario y devolvé SOLO un JSON:
{
  "isValid": <true si la respuesta es apropiada>,
  "reason": "<por qué no es válida, sino null>",
  "correctedResponse": "<respuesta corregida si no es válida, sino null>"
}

Criterios para NO válida:
- Da un precio exacto sin mencionar que puede variar
- Hace compromisos legales (contratos, garantías)
- Información claramente incorrecta
- Tono inapropiado o agresivo

Respuesta a validar: "${state.responseText}"`;

  try {
    const result = await groq.chatJson<{
      isValid: boolean;
      reason: string | null;
      correctedResponse: string | null;
    }>([{ role: 'user', content: prompt }], {
      model: GROQ_MODELS.LLAMA_8B,
      temperature: 0.1,
      maxTokens: 512,
    });

    if (!result.isValid && result.correctedResponse) {
      return { responseText: result.correctedResponse };
    }

    return {};
  } catch (err) {
    // Si falla la validación, dejamos pasar la respuesta original
    logger.warn('validateNode error (passing through)', err);
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NODO: human_takeover
// Se ejecuta cuando shouldEscalate = true.
// ─────────────────────────────────────────────────────────────────────────────

export function humanTakeoverNode(state: GraphState): Partial<GraphState> {
  return {
    responseText:
      `¡Entendido! Voy a conectarte con un asesor de nuestro equipo para ayudarte mejor. ` +
      `En unos momentos alguien se va a comunicar con vos. ¡Gracias por tu paciencia! 😊`,
    currentStage: 'HUMAN',
    shouldEscalate: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: construye el system prompt con contexto del stage
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(state: GraphState): string {
  const stageContext: Record<ConversationStage, string> = {
    INITIAL: 'Es el primer contacto. Saludá y preguntá en qué podés ayudar.',
    QUALIFYING: 'Recopilá información: zona, presupuesto, tipo de propiedad, ambientes.',
    INFORMED: 'El cliente recibió información. Respondé sus dudas y propone una visita.',
    NEGOTIATING: 'El cliente quiere negociar. Sé empático pero no des precios finales.',
    CLOSING: 'El cliente quiere visitar o reservar. Coordiná fecha y hora.',
    FOLLOW_UP: 'Contacto de seguimiento. Preguntá si llegó a una decisión.',
    HUMAN: 'Un agente humano tomó el control. No respondas automáticamente.',
  };

  const entities = Object.entries(state.entities)
    .filter(([, v]) => v && v !== 'null')
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  return `${state.systemPrompt}

Tu nombre es: ${state.personaName}
Stage actual de la conversación: ${state.currentStage}
Instrucción para este stage: ${stageContext[state.currentStage]}
${entities ? `Datos del cliente: ${entities}` : ''}

Respondé en español, de forma conversacional y breve (máximo 3 oraciones).`.trim();
}