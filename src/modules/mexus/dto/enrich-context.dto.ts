// =============================================================================
// modules/mexus/dto/enrich-context.dto.ts
// DTO de entrada cuando MEXUS llama al core para enriquecer contexto.
// TODO: agregar campos específicos del proyecto cuando se integre.
// =============================================================================

import { IsString, IsUUID, IsOptional, IsObject } from 'class-validator';

export class EnrichContextDto {
  @IsUUID()
  projectId!: string;

  @IsUUID()
  organizationId!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsObject()
  // TODO: tiparlo con MEXUSBusinessData cuando se conozca la forma
  additionalContext?: Record<string, unknown>;
}
