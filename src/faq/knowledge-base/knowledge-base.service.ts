// src/faq/knowledge-base/knowledge-base.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto } from './dto/knowledge-base.dto';

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, organizationId: string, dto: CreateKnowledgeBaseDto) {
    const kb = await this.prisma.knowledgeBase.create({
      data: { ...dto, projectId, organizationId },
    });
    this.logger.log(`KnowledgeBase creada: ${kb.id} en proyecto ${projectId}`);
    return { success: true, data: kb };
  }

  async findAll(projectId: string, organizationId: string) {
    const items = await this.prisma.knowledgeBase.findMany({
      where: { projectId, organizationId },
      include: { _count: { select: { documents: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: items };
  }

  async findOne(kbId: string, organizationId: string) {
    const kb = await this.prisma.knowledgeBase.findFirst({
      where: { id: kbId, organizationId },
      include: { _count: { select: { documents: true } } },
    });
    if (!kb) throw new NotFoundException('Knowledge base no encontrada');
    return kb;
  }

  async update(kbId: string, organizationId: string, dto: UpdateKnowledgeBaseDto) {
    await this.findOne(kbId, organizationId);
    return this.prisma.knowledgeBase.update({ where: { id: kbId }, data: dto });
  }

  async remove(kbId: string, organizationId: string) {
    await this.findOne(kbId, organizationId);
    await this.prisma.knowledgeBase.delete({ where: { id: kbId } });
    return { success: true, message: 'Knowledge base eliminada' };
  }

  async getStats(kbId: string, organizationId: string) {
    await this.findOne(kbId, organizationId);
    const [total, byStatus, chunks] = await Promise.all([
      this.prisma.kbDocument.count({ where: { knowledgeBaseId: kbId } }),
      this.prisma.kbDocument.groupBy({
        by: ['status'],
        where: { knowledgeBaseId: kbId },
        _count: { id: true },
      }),
      this.prisma.kbChunk.count({
        where: { document: { knowledgeBaseId: kbId } },
      }),
    ]);
    return { success: true, data: { totalDocuments: total, byStatus, totalChunks: chunks } };
  }
}
