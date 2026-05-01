// src/common/services/embedding.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GroqService } from '../../groq/groq.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  // Sprint 4: cambiar a OpenAI text-embedding-3-small (1536 dims) + pgvector
  static readonly DIMENSIONS = 384;

  constructor(private readonly groq: GroqService) {}

  async embed(text: string): Promise<number[]> {
    const truncated = text.slice(0, 2000);

    try {
      const response = await this.groq.chat(
        [
          {
            role: 'system',
            content: `You are an embedding generator. Given a text, output ONLY a JSON array of ${EmbeddingService.DIMENSIONS} floating point numbers between -1 and 1 that semantically represent the text. Output NOTHING else, no explanation, just the JSON array.`,
          },
          { role: 'user', content: truncated },
        ],
        { model: 'llama-3.1-8b-instant', temperature: 0, maxTokens: 2048 },
      );

      const match = response.content.trim().match(/\[[\d\s,.\-e+]+\]/);
      if (!match) throw new Error('Formato de embedding inválido');

      const embedding = JSON.parse(match[0]) as number[];
      return this.normalize(embedding);
    } catch (err) {
      this.logger.error(`Error generando embedding: ${err}`);
      return new Array(EmbeddingService.DIMENSIONS).fill(0);
    }
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  private normalize(v: number[]): number[] {
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    return norm === 0 ? v : v.map((x) => x / norm);
  }
}
