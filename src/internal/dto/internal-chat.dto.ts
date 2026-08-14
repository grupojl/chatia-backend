// src/internal/dto/internal-chat.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InternalChatDto {
  @ApiProperty({ description: 'ID de la organización (multi-tenant)' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ description: 'Slug del proyecto de chat' })
  @IsString()
  @IsNotEmpty()
  projectSlug: string;

  @ApiProperty({ description: 'ID del usuario final (cliente)' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Mensaje del usuario' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Canal de origen',
    enum: ['api', 'widget', 'whatsapp', 'instagram', 'messenger', 'tiktok'],
    default: 'api',
  })
  @IsOptional()
  @IsEnum(['api', 'widget', 'whatsapp', 'instagram', 'messenger', 'tiktok'])
  channel?: string;
}

export class InternalProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
