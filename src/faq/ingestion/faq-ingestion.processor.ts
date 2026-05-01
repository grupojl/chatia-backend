// src/faq/ingestion/faq-ingestion.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../../queue/queue.constants';
import { FaqIngestionService } from './faq-ingestion.service';
import { IngestJobData } from '../document/kb-document.service';

@Processor(QUEUES.FAQ_INGEST)
export class FaqIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(FaqIngestionProcessor.name);

  constructor(private readonly ingestion: FaqIngestionService) {
    super();
  }

  async process(job: Job<IngestJobData>): Promise<void> {
    this.logger.debug(`[job:${job.id}] Ingesta — doc: ${job.data.documentId} — intento ${job.attemptsMade + 1}`);
    await this.ingestion.ingestDocument(job.data.documentId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<IngestJobData>, error: Error): void {
    this.logger.error(
      `[job:${job.id}] Falló intento ${job.attemptsMade}/${job.opts.attempts} — doc: ${job.data.documentId} — ${error.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<IngestJobData>): void {
    this.logger.debug(`[job:${job.id}] Indexado OK — doc: ${job.data.documentId}`);
  }
}
