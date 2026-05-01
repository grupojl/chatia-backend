// src/faq/query/faq-query.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../../common/services/embedding.service';

export interface ChunkResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
}

@Injectable()
export class FaqQueryService {
  private readonly logger = new Logger(FaqQueryService.name);
  private pgvectorAvailable: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async search(kbId: string, query: string, topK = 5): Promise<ChunkResult[]> {
    const queryEmbedding = await this.embedding.embed(query);

    // Intentar pgvector primero; si falla, fallback en memoria
    if (await this.isPgvectorAvailable()) {
      try {
        return await this.searchWithPgvector(kbId, queryEmbedding, topK);
      } catch (err) {
        this.logger.warn(`pgvector falló, usando fallback en memoria: ${err}`);
        this.pgvectorAvailable = false;
      }
    }

    return this.searchInMemory(kbId, queryEmbedding, topK);
  }

  // ── pgvector via $queryRaw ────────────────────────────────────────────────

  private async searchWithPgvector(
    kbId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<ChunkResult[]> {
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        document_id: string;
        document_title: string;
        content: string;
        score: number;
      }>
    >`
      SELECT
        c.id,
        c."documentId"   AS document_id,
        d.title          AS document_title,
        c.content,
        1 - (c.embedding <=> ${vectorStr}::vector) AS score
      FROM "KbChunk" c
      JOIN "KbDocument" d ON d.id = c."documentId"
      WHERE d."knowledgeBaseId" = ${kbId}
        AND d.status = 'INDEXED'
        AND c.embedding IS NOT NULL
      ORDER BY score DESC
      LIMIT ${topK}
    `;

    return rows.map((r) => ({
      chunkId: r.id,
      documentId: r.document_id,
      documentTitle: r.document_title,
      content: r.content,
      score: Number(r.score),
    }));
  }

  // ── Fallback en memoria (MVP / sin pgvector) ──────────────────────────────

  private async searchInMemory(
    kbId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<ChunkResult[]> {
    const chunks = await this.prisma.kbChunk.findMany({
      where: { document: { knowledgeBaseId: kbId, status: 'INDEXED' } },
      include: { document: { select: { title: true } } },
    });

    return chunks
      .filter((c) => Array.isArray(c.embedding) && (c.embedding as number[]).length > 0)
      .map((c) => ({
        chunkId: c.id,
        documentId: c.documentId,
        documentTitle: c.document.title,
        content: c.content,
        score: this.embedding.cosineSimilarity(queryEmbedding, c.embedding as number[]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // ── Detección de pgvector ─────────────────────────────────────────────────

  private async isPgvectorAvailable(): Promise<boolean> {
    if (this.pgvectorAvailable !== null) return this.pgvectorAvailable;
    try {
      await this.prisma.$queryRaw`SELECT '[1,2,3]'::vector`;
      this.pgvectorAvailable = true;
    } catch {
      this.pgvectorAvailable = false;
    }
    return this.pgvectorAvailable;
  }
}
