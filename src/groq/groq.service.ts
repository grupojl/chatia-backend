// src/groq/groq.service.ts
import { Injectable, Logger } from '@nestjs/common';

export const GROQ_MODELS = {
  LLAMA_70B: 'llama-3.3-70b-versatile',   // mejor calidad — respuestas al cliente
  LLAMA_8B: 'llama-3.1-8b-instant',        // más rápido — clasificación, intent
  MIXTRAL: 'mixtral-8x7b-32768',           // contexto largo — resúmenes
} as const;

export type GroqModel = (typeof GROQ_MODELS)[keyof typeof GROQ_MODELS];

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqResponse {
  content: string;
  tokensUsed: number;
  model: string;
}

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly API_URL = 'https://api.groq.com/openai/v1/chat/completions';

  async chat(
    messages: GroqMessage[],
    options: {
      model?: GroqModel;
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
    } = {},
  ): Promise<GroqResponse> {
    const {
      model = GROQ_MODELS.LLAMA_70B,
      temperature = 0.7,
      maxTokens = 1024,
      jsonMode = false,
    } = options;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      this.logger.error(`Groq API error: ${error}`);
      throw new Error(`Groq API error: ${res.status}`);
    }

    const data = await res.json() as any;
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content ?? '',
      tokensUsed: data.usage?.total_tokens ?? 0,
      model,
    };
  }

  /** Shortcut para obtener JSON estructurado */
  async chatJson<T>(
    messages: GroqMessage[],
    options: Parameters<GroqService['chat']>[1] = {},
  ): Promise<T> {
    const response = await this.chat(messages, { ...options, jsonMode: true });
    try {
      return JSON.parse(response.content) as T;
    } catch {
      throw new Error(`Groq devolvió JSON inválido: ${response.content}`);
    }
  }
}