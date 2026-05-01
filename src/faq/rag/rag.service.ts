// src/faq/rag/rag.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GroqService } from '../../groq/groq.service';
import { FaqQueryService, ChunkResult } from '../query/faq-query.service';

export interface RagAnswer {
  answer: string;
  sources: Array<{ documentId: string; documentTitle: string; excerpt: string; score: number }>;
  tokensUsed: number;
  modelUsed: string;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly faqQuery: FaqQueryService,
    private readonly groq: GroqService,
  ) {}

  async answer(
    kbId: string,
    question: string,
    options: { groqModel?: string; temperature?: number; maxTokens?: number } = {},
  ): Promise<RagAnswer> {
    // 1. Recuperar chunks relevantes
    const chunks = await this.faqQuery.search(kbId, question, 5);

    if (!chunks.length) {
      return {
        answer: 'No encontré información relevante en la base de conocimiento.',
        sources: [],
        tokensUsed: 0,
        modelUsed: '',
      };
    }

    // 2. Construir contexto
    const context = chunks
      .map((c, i) => `[${i + 1}] ${c.documentTitle}\n${c.content}`)
      .join('\n\n---\n\n');

    // 3. Llamar a Groq con prompt aumentado
    const result = await this.groq.chat(
      [
        {
          role: 'system',
          content: `Sos un asistente que responde preguntas basándose ÚNICAMENTE en el contexto provisto.
Si la respuesta no está en el contexto, decí claramente que no tenés esa información.
Respondé en español, de forma concisa y citando el número de fuente cuando corresponda [1], [2], etc.`,
        },
        {
          role: 'user',
          content: `Contexto:\n\n${context}\n\nPregunta: ${question}`,
        },
      ],
      {
        model: (options.groqModel ?? 'llama-3.3-70b-versatile') as any,
        temperature: options.temperature ?? 0.3,
        maxTokens: options.maxTokens ?? 1024,
      },
    );

    return {
      answer: result.content,
      sources: chunks.map((c) => ({
        documentId: c.documentId,
        documentTitle: c.documentTitle,
        excerpt: c.content.slice(0, 200),
        score: c.score,
      })),
      tokensUsed: result.tokensUsed,
      modelUsed: result.model,
    };
  }
}
