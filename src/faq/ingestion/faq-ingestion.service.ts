// src/faq/ingestion/faq-ingestion.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../../common/services/embedding.service';

const CHUNK_SIZE   = 512;   // caracteres aproximados por chunk
const CHUNK_OVERLAP = 51;   // ~10% de overlap

@Injectable()
export class FaqIngestionService {
  private readonly logger = new Logger(FaqIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async ingestDocument(documentId: string): Promise<void> {
    const doc = await this.prisma.kbDocument.findUniqueOrThrow({
      where: { id: documentId },
    });

    await this.prisma.kbDocument.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    try {
      const text = await this.extractText(doc);
      const chunks = this.chunkText(text);

      this.logger.debug(`[${documentId}] ${chunks.length} chunks generados`);

      // Borrar chunks previos (re-indexación)
      await this.prisma.kbChunk.deleteMany({ where: { documentId } });

      // Generar embeddings y guardar chunks
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.embedding.embed(chunks[i]);
        await this.prisma.kbChunk.create({
          data: {
            documentId,
            content: chunks[i],
            chunkIndex: i,
            embedding,
            metadata: { sourceType: doc.sourceType, title: doc.title },
          },
        });
      }

      await this.prisma.kbDocument.update({
        where: { id: documentId },
        data: { status: 'INDEXED', chunkCount: chunks.length, indexedAt: new Date(), errorMessage: null },
      });

      this.logger.log(`[${documentId}] Indexado OK — ${chunks.length} chunks`);
    } catch (err) {
      this.logger.error(`[${documentId}] Error en ingesta: ${err}`);
      await this.prisma.kbDocument.update({
        where: { id: documentId },
        data: { status: 'FAILED', errorMessage: String(err) },
      });
      throw err;
    }
  }

  // ── Extracción de texto por tipo ─────────────────────────────────────────

  private async extractText(doc: {
    sourceType: string;
    rawContent: string | null;
    sourceUrl: string | null;
  }): Promise<string> {
    switch (doc.sourceType) {
      case 'TEXT':
      case 'MARKDOWN':
        return doc.rawContent ?? '';

      case 'PDF':
        return this.extractPdf(doc.rawContent ?? '');

      case 'URL':
        return this.extractUrl(doc.sourceUrl ?? '');

      case 'JSON':
        return this.extractJson(doc.rawContent ?? '');

      default:
        return doc.rawContent ?? '';
    }
  }

  private async extractPdf(base64OrPath: string): Promise<string> {
    try {
      // pdf-parse: importar como CJS compatible
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
      const buffer = Buffer.from(base64OrPath, 'base64');
      const result = await pdfParse(buffer);
      return result.text;
    } catch (err) {
      this.logger.warn(`No se pudo parsear PDF: ${err}`);
      return base64OrPath;
    }
  }

  private async extractUrl(url: string): Promise<string> {
    try {
      const { extract } = await import('@extractus/article-extractor');
      const article = await extract(url);
      return article?.content ?? '';
    } catch {
      // Fallback con cheerio
      try {
        const response = await fetch(url);
        const html = await response.text();
        const cheerio = await import('cheerio');
        const $ = cheerio.load(html);
        $('script, style, nav, footer, header').remove();
        return $('body').text().replace(/\s+/g, ' ').trim();
      } catch (err2) {
        this.logger.warn(`No se pudo extraer URL ${url}: ${err2}`);
        return '';
      }
    }
  }

  private extractJson(raw: string): string {
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  }

  // ── Chunking con overlap ─────────────────────────────────────────────────

  chunkText(text: string): string[] {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];
    if (cleaned.length <= CHUNK_SIZE) return [cleaned];

    const chunks: string[] = [];
    let start = 0;

    while (start < cleaned.length) {
      const end = Math.min(start + CHUNK_SIZE, cleaned.length);
      let slice = cleaned.slice(start, end);

      // Cortar en límite de oración si es posible
      if (end < cleaned.length) {
        const lastPeriod = slice.lastIndexOf('. ');
        if (lastPeriod > CHUNK_SIZE * 0.5) {
          slice = slice.slice(0, lastPeriod + 1);
        }
      }

      chunks.push(slice.trim());
      start += slice.length - CHUNK_OVERLAP;
    }

    return chunks.filter((c) => c.length > 20);
  }
}
