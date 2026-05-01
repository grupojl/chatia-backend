// src/analytics/analytics.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';
import { IsOptional, IsDateString } from 'class-validator';

class AnalyticsQueryDto {
  @IsDateString() @IsOptional()
  from?: string;

  @IsDateString() @IsOptional()
  to?: string;
}

@Controller('analytics')
@UseGuards(TenantGuard)
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  /** GET /analytics/overview?from=2026-01-01&to=2026-04-30 */
  @Get('overview')
  overview(@Tenant() t: TenantContext, @Query() q: AnalyticsQueryDto) {
    const from = q.from ? new Date(q.from) : this.defaultFrom();
    const to = q.to ? new Date(q.to) : new Date();
    return this.svc.getOverview(t.organizationId, from, to);
  }

  /** GET /analytics/conversations — desglose por día */
  @Get('conversations')
  conversations(@Tenant() t: TenantContext, @Query() q: AnalyticsQueryDto) {
    const from = q.from ? new Date(q.from) : this.defaultFrom();
    const to = q.to ? new Date(q.to) : new Date();
    return this.svc.getConversationsByDay(t.organizationId, from, to);
  }

  /** GET /analytics/agents — métricas por agente */
  @Get('agents')
  agents(@Tenant() t: TenantContext, @Query() q: AnalyticsQueryDto) {
    const from = q.from ? new Date(q.from) : this.defaultFrom();
    const to = q.to ? new Date(q.to) : new Date();
    return this.svc.getAgentMetrics(t.organizationId, from, to);
  }

  private defaultFrom(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }
}
