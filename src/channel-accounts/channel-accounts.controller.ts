// src/channel-accounts/channel-accounts.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ChannelAccountsService,
  CreateChannelAccountDto,
  UpdateChannelAccountDto,
} from './channel-accounts.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';

@Controller('channel-accounts')
@UseGuards(TenantGuard)
export class ChannelAccountsController {
  constructor(private readonly svc: ChannelAccountsService) {}

  @Post()
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateChannelAccountDto) {
    return this.svc.create(tenant.organizationId, dto);
  }

  @Get()
  list(@Tenant() tenant: TenantContext) {
    return this.svc.list(tenant.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.findOne(id, tenant.organizationId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
    @Body() dto: UpdateChannelAccountDto,
  ) {
    return this.svc.update(id, tenant.organizationId, dto);
  }

  @Post(':id/rotate-token')
  rotateToken(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.rotateToken(id, tenant.organizationId);
  }
}