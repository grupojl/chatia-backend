// src/messages/messages.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class PaginationDto {
  @Type(() => Number) @IsInt() @Min(1) @IsOptional()
  page?: number;

  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional()
  limit?: number;
}

@Controller()
@UseGuards(TenantGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /** GET /conversations/:id/messages */
  @Get('conversations/:id/messages')
  list(
    @Param('id') conversationId: string,
    @Tenant() tenant: TenantContext,
    @Query() query: PaginationDto,
  ) {
    return this.messagesService.listByConversation(
      conversationId,
      tenant.organizationId,
      query.page,
      query.limit,
    );
  }

  /** GET /messages/stats */
  @Get('messages/stats')
  stats(@Tenant() tenant: TenantContext) {
    return this.messagesService.getStats(tenant.organizationId);
  }
}