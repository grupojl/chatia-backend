// src/assistant/assistant.controller.ts
import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { WritePermissionGuard } from '../common/guards/write-permission.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';
import { AssistantChatService } from './chat/assistant-chat.service';
import { AssistantConfigService } from './config/assistant-config.service';
import { AssistantSessionService } from './session/assistant-session.service';
import { ChatDto } from './dto/chat.dto';
import { UpdateAssistantConfigDto } from './config/dto/assistant-config.dto';

class ToggleDto {
  @IsBoolean()
  enabled: boolean;
}

@ApiTags('Assistant')
@ApiBearerAuth()
@Controller('projects/:slug/assistant')
@UseGuards(TenantGuard)
export class AssistantController {
  constructor(
    private readonly chatService: AssistantChatService,
    private readonly configService: AssistantConfigService,
    private readonly sessionService: AssistantSessionService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Obtener configuración del asistente' })
  getConfig(@Param('slug') slug: string, @Tenant() t: TenantContext) {
    return this.configService.findByProjectSlug(slug, t.organizationId);
  }

  @Put('config')
  @UseGuards(WritePermissionGuard)
  @ApiOperation({ summary: 'Actualizar configuración (requiere canWrite)' })
  async updateConfig(
    @Param('slug') slug: string,
    @Tenant() t: TenantContext,
    @Body() dto: UpdateAssistantConfigDto,
  ) {
    const config = await this.configService.findByProjectSlug(slug, t.organizationId);
    return this.configService.update(config.projectId, t.organizationId, dto);
  }

  @Patch('config/toggle')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WritePermissionGuard)
  @ApiOperation({ summary: 'Habilitar/deshabilitar asistente (requiere canWrite)' })
  async toggleConfig(
    @Param('slug') slug: string,
    @Tenant() t: TenantContext,
    @Body() dto: ToggleDto,
  ) {
    const config = await this.configService.findByProjectSlug(slug, t.organizationId);
    return this.configService.toggleEnabled(config.projectId, t.organizationId, dto.enabled);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Enviar mensaje al asistente' })
  @ApiResponse({ status: 201 })
  chat(
    @Param('slug') slug: string,
    @Tenant() t: TenantContext,
    @Body() dto: ChatDto,
  ) {
    return this.chatService.chat({
      projectSlug: slug,
      organizationId: t.organizationId,
      userId: dto.userId,
      message: dto.message,
      channel: dto.channel ?? 'api',
    });
  }

  @Get('session/:userId')
  @ApiOperation({ summary: 'Obtener sesión de un usuario' })
  async getSession(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Tenant() t: TenantContext,
  ) {
    const config = await this.configService.findByProjectSlug(slug, t.organizationId);
    return this.sessionService.getOrCreate(config.id, t.organizationId, userId, 'api');
  }

  @Delete('session/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WritePermissionGuard)
  @ApiOperation({ summary: 'Resetear sesión de un usuario (requiere canWrite)' })
  async resetSession(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Tenant() t: TenantContext,
  ) {
    const config = await this.configService.findByProjectSlug(slug, t.organizationId);
    const session = await this.sessionService.getOrCreate(config.id, t.organizationId, userId, 'api');
    await this.sessionService.resetSession(session.id);
    return { success: true, message: 'Sesión reseteada' };
  }
}
