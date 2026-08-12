// src/ecosystem/ecosystem.controller.ts
//
// Endpoints de administración de plataforma.
// Protegidos con x-platform-admin-key — NO usan TenantGuard.
// Solo se invocan durante el onboarding de un ecosistema nuevo.
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { EcosystemService }     from './ecosystem.service';
import { RegisterEcosystemDto } from './dto/register-ecosystem.dto';

@ApiTags('ecosystems')
@ApiHeader({ name: 'x-platform-admin-key', description: 'Clave de admin de plataforma' })
@Controller('ecosystems')
export class EcosystemController {
  constructor(private readonly svc: EcosystemService) {}

  private guard(key: string | undefined): void {
    const valid = process.env['PLATFORM_ADMIN_KEY'];
    if (!valid || key !== valid) {
      throw new ForbiddenException('x-platform-admin-key inválida o ausente');
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar ecosistema nuevo' })
  register(
    @Headers('x-platform-admin-key') key: string,
    @Body() dto: RegisterEcosystemDto,
  ) {
    this.guard(key);
    return this.svc.register(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar ecosistemas registrados' })
  findAll(@Headers('x-platform-admin-key') key: string) {
    this.guard(key);
    return this.svc.findAll();
  }

  @Patch(':id/config')
  @ApiOperation({ summary: 'Actualizar config de un ecosistema' })
  updateConfig(
    @Headers('x-platform-admin-key') key: string,
    @Param('id') id: string,
    @Body() config: Record<string, unknown>,
  ) {
    this.guard(key);
    return this.svc.updateConfig(id, config);
  }

  @Delete(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar ecosistema' })
  deactivate(
    @Headers('x-platform-admin-key') key: string,
    @Param('id') id: string,
  ) {
    this.guard(key);
    return this.svc.deactivate(id);
  }
}
