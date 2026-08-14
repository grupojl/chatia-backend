// src/internal/internal.controller.ts
//
// Endpoints consumidos por servicios internos del ecosistema.
// Protegidos por InternalApiKeyGuard — sin Firebase, sin TenantGuard.
//
// Consumidores:
//   realsass-sass-back      → POST /internal/chat, GET /internal/projects
//   realsass-ecommerce-back → POST /internal/chat (soporte en órdenes)
//
// Headers requeridos en cada request:
//   x-api-key: {CHAT_INTERNAL_API_KEY}
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalApiKeyGuard }  from './internal-api-key.guard';
import { InternalChatDto, InternalProjectDto } from './dto/internal-chat.dto';
import { AssistantChatService } from '../assistant/chat/assistant-chat.service';
import { ProjectsService }      from '../projects/projects.service';

@ApiTags('Internal (API Key)')
@ApiHeader({ name: 'x-api-key', description: 'Clave interna del ecosistema', required: true })
@Controller('internal')
@UseGuards(InternalApiKeyGuard)
export class InternalController {
  constructor(
    private readonly chatService:     AssistantChatService,
    private readonly projectsService: ProjectsService,
  ) {}

  // ── Chat ──────────────────────────────────────────────────────────────────

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar mensaje al asistente (server-to-server)' })
  chat(@Body() dto: InternalChatDto) {
    return this.chatService.chat({
      projectSlug:    dto.projectSlug,
      organizationId: dto.organizationId,
      userId:         dto.userId,
      message:        dto.message,
      channel:        (dto.channel as any) ?? 'api',
    });
  }

  // ── Proyectos ─────────────────────────────────────────────────────────────

  @Get('projects/:organizationId')
  @ApiOperation({ summary: 'Listar proyectos de una organización' })
  listProjects(@Param('organizationId') organizationId: string) {
    return this.projectsService.findAll(organizationId);
  }

  @Post('projects')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear proyecto para una organización' })
  createProject(@Body() dto: InternalProjectDto) {
    return this.projectsService.create(dto.organizationId, {
      name:        dto.name,
      description: dto.description,
    });
  }

  @Delete('projects/:organizationId/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar proyecto' })
  deleteProject(
    @Param('organizationId') organizationId: string,
    @Param('slug') slug: string,
  ) {
    return this.projectsService.remove(organizationId, slug);
  }

  // ── Health interno ────────────────────────────────────────────────────────

  @Get('ping')
  @ApiOperation({ summary: 'Verificar conectividad desde ecosistema' })
  ping() {
    return { ok: true, service: 'chat-ia', timestamp: new Date().toISOString() };
  }
}
