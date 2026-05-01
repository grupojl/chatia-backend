// src/ai-config/ai-config.controller.ts
import {
  Controller, Get, Put, Patch, Body, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AiConfigService } from './ai-config.service';
import type { TenantContext } from '../common/types/tenant-context';
import { Tenant } from '../common/decorators/tenant.decorator';
import { UpdateAiConfigDto } from './dto/update-ai-config.dto';

class ToggleAiDto {
  @IsBoolean()
  enabled: boolean;
}

@Controller('channel-accounts/:accountId/ai-config')
@UseGuards(TenantGuard)
export class AiConfigController {
  constructor(private readonly aiConfigService: AiConfigService) {}

  @Get()
  get(@Param('accountId') accountId: string, @Tenant() tenant: TenantContext) {
    return this.aiConfigService.getOrCreate(accountId, tenant.organizationId);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  update(
    @Param('accountId') accountId: string,
    @Tenant() tenant: TenantContext,
    @Body() dto: UpdateAiConfigDto,
  ) {
    return this.aiConfigService.update(accountId, tenant.organizationId, dto);
  }

  @Patch('toggle')
  @HttpCode(HttpStatus.OK)
  toggle(
    @Param('accountId') accountId: string,
    @Tenant() tenant: TenantContext,
    @Body() dto: ToggleAiDto,
  ) {
    return this.aiConfigService.toggleEnabled(accountId, tenant.organizationId, dto.enabled);
  }
}