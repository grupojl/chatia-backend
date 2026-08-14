// src/projects/dto/create-project.dto.ts
import {
  IsString, IsOptional, IsBoolean,
  MinLength, MaxLength, Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiPropertyOptional({ example: 'shopbot-real-estate' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug debe ser kebab-case (ej: shopbot-inmobiliaria)',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'Shopbot Inmobiliaria' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
