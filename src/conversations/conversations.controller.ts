// src/conversations/conversations.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { ConversationsService } from './conversations.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';

class TagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  tag: string;
}

@Controller('conversations')
@UseGuards(TenantGuard)
export class ConversationsController {
  constructor(private readonly svc: ConversationsService) {}

  @Get()
  list(@Tenant() t: TenantContext, @Query() q: any) {
    return this.svc.list(t.organizationId, q);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() t: TenantContext) {
    return this.svc.findOne(id, t.organizationId);
  }

  @Post(':id/messages')
  sendMessage(
    @Param('id') id: string,
    @Tenant() t: TenantContext,
    @Body('text') text: string,
  ) {
    return this.svc.sendManualMessage(id, t.organizationId, text);
  }

  @Patch(':id/takeover')
  takeover(
    @Param('id') id: string,
    @Tenant() t: TenantContext,
    @Body('agentId') agentId: string,
  ) {
    return this.svc.takeover(id, t.organizationId, agentId);
  }

  @Patch(':id/release')
  release(@Param('id') id: string, @Tenant() t: TenantContext) {
    return this.svc.release(id, t.organizationId);
  }

  @Patch(':id/resolve')
  resolve(@Param('id') id: string, @Tenant() t: TenantContext) {
    return this.svc.resolve(id, t.organizationId);
  }

  /** DELETE /conversations/:id — soft delete (archiva) */
  @Delete(':id')
  softDelete(@Param('id') id: string, @Tenant() t: TenantContext) {
    return this.svc.softDelete(id, t.organizationId);
  }

  /** PATCH /conversations/:id/restore — restaurar conversación archivada */
  @Patch(':id/restore')
  restore(@Param('id') id: string, @Tenant() t: TenantContext) {
    return this.svc.restore(id, t.organizationId);
  }

  /** POST /conversations/:id/tags   body: { tag: "urgente" } */
  @Post(':id/tags')
  addTag(
    @Param('id') id: string,
    @Tenant() t: TenantContext,
    @Body() dto: TagDto,
  ) {
    return this.svc.addTag(id, t.organizationId, dto.tag);
  }

  /** DELETE /conversations/:id/tags/:tag */
  @Delete(':id/tags/:tag')
  removeTag(
    @Param('id') id: string,
    @Param('tag') tag: string,
    @Tenant() t: TenantContext,
  ) {
    return this.svc.removeTag(id, t.organizationId, tag);
  }
}
