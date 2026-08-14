// src/projects/projects.controller.ts
import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { TenantGuard } from '../common/guards/tenant.guard';
import { WritePermissionGuard } from '../common/guards/write-permission.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(TenantGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(WritePermissionGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Crear proyecto (admin)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 403, description: 'Sin permisos de escritura o rol admin' })
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(tenant.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar proyectos de la organización' })
  findAll(@Tenant() tenant: TenantContext) {
    return this.projectsService.findAll(tenant.organizationId);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Detalle de proyecto por slug' })
  findOne(@Param('slug') slug: string, @Tenant() tenant: TenantContext) {
    return this.projectsService.findOne(slug, tenant.organizationId);
  }

  @Put(':slug')
  @UseGuards(WritePermissionGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar proyecto (admin)' })
  update(
    @Param('slug') slug: string,
    @Tenant() tenant: TenantContext,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(slug, tenant.organizationId, dto);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WritePermissionGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar proyecto (admin)' })
  remove(@Param('slug') slug: string, @Tenant() tenant: TenantContext) {
    return this.projectsService.remove(slug, tenant.organizationId);
  }
}
