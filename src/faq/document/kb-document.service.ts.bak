// src/faq/document/kb-document.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateKbDocumentDto } from './dto/kb-document.dto';
import { QUEUES, JOBS } from '../../queue/queue.constants';

export interface IngestJobData { documentId: string; organizationId: string; }

@Injectable()
export class KbDocumentService {
  private readonly logger = new Logger(KbDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.FAQ_INGEST) private readonly ingestQueue: Queue<IngestJobData>,
  ) {}

  async create(kbId: string, organizationId: string, dto: CreateKbDocumentDto) {
    const kb = await this.prisma.knowledgeBase.findFirst({
      where: { id: kbId, organizationId },
    });
    if (!kb) throw new NotFoundException('Knowledge base no encontrada');

    const doc = await this.prisma.kbDocument.create({
      data: { ...dto, knowledgeBaseId: kbId, organizationId, status: 'PENDING' },
    });

    await this.enqueueIngest(doc.id, organizationId);
    this.logger.log(`Documento creado y encolado: ${doc.id}`);
    return { success: true, data: doc };
  }

  async findAll(kbId: string, organizationId: string, status?: string) {
    const docs = await this.prisma.kbDocument.findMany({
      where: {
        knowledgeBaseId: kbId,
        organizationId,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: docs };
  }

  async reindex(documentId: string, organizationId: string) {
    const doc = await this.prisma.kbDocument.findFirst({
      where: { id: documentId, organizationId },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    // Borrar chunks anteriores
    await this.prisma.kbChunk.deleteMany({ where: { documentId } });

    await this.prisma.kbDocument.update({
      where: { id: documentId },
      data: { status: 'PENDING', chunkCount: 0, errorMessage: null, indexedAt: null },
    });

    await this.enqueueIngest(documentId, organizationId);
    return { success: true, message: 'Re-indexación encolada' };
  }

  async remove(documentId: string, organizationId: string) {
    const doc = await this.prisma.kbDocument.findFirst({
      where: { id: documentId, organizationId },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.prisma.kbDocument.delete({ where: { id: documentId } });
    return { success: true, message: 'Documento eliminado' };
  }

  private async enqueueIngest(documentId: string, organizationId: string) {
    await this.ingestQueue.add(
      JOBS.FAQ_INGEST_DOCUMENT,
      { documentId, organizationId },
      {
        jobId: `ingest:${documentId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
  }
}
