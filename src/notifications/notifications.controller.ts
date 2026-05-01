// src/notifications/notifications.controller.ts
import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { NotificationsService } from './notifications.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';

class ListNotificationsDto {
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  @IsOptional()
  unread?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(TenantGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificaciones del agente autenticado' })
  list(@Tenant() tenant: TenantContext, @Query() query: ListNotificationsDto) {
    if (!tenant.agentId) return { success: true, data: [] };
    return this.svc.list(tenant.agentId, query.unread, query.page);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas como leídas' })
  markAllRead(@Tenant() tenant: TenantContext) {
    if (!tenant.agentId) return { success: true };
    return this.svc.markAllRead(tenant.agentId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  markRead(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    if (!tenant.agentId) return { success: true };
    return this.svc.markRead(id, tenant.agentId);
  }
}
