// src/contacts/contacts.controller.ts
import {
  Controller, Get, Patch, Body, Param, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ContactsService, UpdateContactDto, ListContactsDto } from './contacts.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';

@Controller('contacts')
@UseGuards(TenantGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@Tenant() tenant: TenantContext, @Query() query: ListContactsDto) {
    return this.contactsService.list(tenant.organizationId, query);
  }

  @Get('stats')
  stats(@Tenant() tenant: TenantContext) {
    return this.contactsService.getStats(tenant.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.contactsService.findOne(id, tenant.organizationId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(id, tenant.organizationId, dto);
  }
}