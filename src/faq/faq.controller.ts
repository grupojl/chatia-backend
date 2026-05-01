// src/faq/faq.controller.ts
import {
  Controller, Get, Post, Put, Delete, Param, Body,
  Query, UseGuards, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeBaseService } from './knowledge-base/knowledge-base.service';
import { KbDocumentService } from './document/kb-document.service';
import { FaqQueryService } from './query/faq-query.service';
import { RagService } from './rag/rag.service';
import { CacheService } from '../common/services/cache.service';
import { CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto } from './knowledge-base/dto/knowledge-base.dto';
import { CreateKbDocumentDto } from './document/dto/kb-document.dto';
import { FaqQueryDto } from './query/dto/faq-query.dto';

@ApiTags('FAQ')
@ApiBearerAuth()
@Controller('projects/:slug/faq')
@UseGuards(TenantGuard)
export class FaqController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kbService: KnowledgeBaseService,
    private readonly docService: KbDocumentService,
    private readonly queryService: FaqQueryService,
    private readonly ragService: RagService,
    private readonly cache: CacheService,
  ) {}

  // ── Knowledge Bases ───────────────────────────────────────────────────────

  @Post('knowledge-bases')
  @ApiOperation({ summary: 'Crear knowledge base' })
  async createKb(@Param('slug') slug: string, @Tenant() t: TenantContext, @Body() dto: CreateKnowledgeBaseDto) {
    const project = await this.resolveProject(slug, t.organizationId);
    return this.kbService.create(project.id, t.organizationId, dto);
  }

  @Get('knowledge-bases')
  @ApiOperation({ summary: 'Listar knowledge bases' })
  async findAllKbs(@Param('slug') slug: string, @Tenant() t: TenantContext) {
    const project = await this.resolveProject(slug, t.organizationId);
    return this.kbService.findAll(project.id, t.organizationId);
  }

  @Get('knowledge-bases/:kbId')
  @ApiOperation({ summary: 'Detalle de knowledge base' })
  findOneKb(@Param('kbId') kbId: string, @Tenant() t: TenantContext) {
    return this.kbService.findOne(kbId, t.organizationId);
  }

  @Put('knowledge-bases/:kbId')
  @ApiOperation({ summary: 'Actualizar knowledge base' })
  updateKb(@Param('kbId') kbId: string, @Tenant() t: TenantContext, @Body() dto: UpdateKnowledgeBaseDto) {
    return this.kbService.update(kbId, t.organizationId, dto);
  }

  @Delete('knowledge-bases/:kbId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar knowledge base' })
  removeKb(@Param('kbId') kbId: string, @Tenant() t: TenantContext) {
    return this.kbService.remove(kbId, t.organizationId);
  }

  @Get('knowledge-bases/:kbId/stats')
  @ApiOperation({ summary: 'Stats de indexación' })
  statsKb(@Param('kbId') kbId: string, @Tenant() t: TenantContext) {
    return this.kbService.getStats(kbId, t.organizationId);
  }

  // ── Documentos ────────────────────────────────────────────────────────────

  @Post('knowledge-bases/:kbId/documents')
  @ApiOperation({ summary: 'Crear documento' })
  createDoc(@Param('kbId') kbId: string, @Tenant() t: TenantContext, @Body() dto: CreateKbDocumentDto) {
    return this.docService.create(kbId, t.organizationId, dto);
  }

  @Post('knowledge-bases/:kbId/documents/upload')
  @ApiOperation({ summary: 'Upload PDF' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadPdf(
    @Param('kbId') kbId: string,
    @Tenant() t: TenantContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const base64 = file.buffer.toString('base64');
    return this.docService.create(kbId, t.organizationId, {
      title: file.originalname,
      sourceType: 'PDF' as any,
      rawContent: base64,
    });
  }

  @Get('knowledge-bases/:kbId/documents')
  @ApiOperation({ summary: 'Listar documentos' })
  findAllDocs(@Param('kbId') kbId: string, @Tenant() t: TenantContext, @Query('status') status?: string) {
    return this.docService.findAll(kbId, t.organizationId, status);
  }

  @Post('knowledge-bases/:kbId/documents/:docId/reindex')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-indexar documento' })
  async reindexDoc(@Param('kbId') kbId: string, @Param('docId') docId: string, @Tenant() t: TenantContext) {
    // Invalidar cache del KB al re-indexar
    await this.cache.del(`faq:${kbId}:*`);
    return this.docService.reindex(docId, t.organizationId);
  }

  @Delete('knowledge-bases/:kbId/documents/:docId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar documento' })
  async removeDoc(@Param('kbId') kbId: string, @Param('docId') docId: string, @Tenant() t: TenantContext) {
    await this.cache.del(`faq:${kbId}:*`);
    return this.docService.remove(docId, t.organizationId);
  }

  // ── Query / RAG ───────────────────────────────────────────────────────────

  @Post('query')
  @ApiOperation({ summary: 'Búsqueda semántica — con includeAnswer=true genera respuesta RAG' })
  async query(@Tenant() t: TenantContext, @Body() dto: FaqQueryDto) {
    const topK = dto.topK ?? 5;

    if (dto.includeAnswer) {
      // Con cache Redis (TTL 1 hora)
      const cacheKey = this.cache.buildFaqKey(dto.kbId, dto.question);
      const cached = await this.cache.get<object>(cacheKey);
      if (cached) return cached;

      const result = await this.ragService.answer(dto.kbId, dto.question);
      await this.cache.set(cacheKey, result, 3600);
      return result;
    }

    // Solo chunks sin generar respuesta
    return this.queryService.search(dto.kbId, dto.question, topK);
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  private async resolveProject(slug: string, organizationId: string) {
    const project = await this.prisma.project.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
    });
    if (!project) throw new NotFoundException(`Proyecto "${slug}" no encontrado`);
    return project;
  }
}
