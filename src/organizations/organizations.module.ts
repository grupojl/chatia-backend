// src/organizations/organizations.module.ts
import { Global, Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';

@Global() // Global para que TenantGuard lo pueda inyectar en cualquier módulo
@Module({
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
