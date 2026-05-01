// src/faq/document/dto/kb-document.dto.ts
import {
  IsString, IsOptional, IsArray, IsEnum, MinLength, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum KbSourceTypeDto {
  TEXT     = 'TEXT',
  MARKDOWN = 'MARKDOWN',
  PDF      = 'PDF',
  URL      = 'URL',
  JSON     = 'JSON',
}

export class CreateKbDocumentDto {
  @ApiProperty({ example: 'Guía de instalación' })
  @IsString() @MinLength(2) @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ enum: KbSourceTypeDto, default: 'TEXT' })
  @IsEnum(KbSourceTypeDto) @IsOptional()
  sourceType?: KbSourceTypeDto;

  @ApiPropertyOptional({ example: 'https://docs.mi-app.com/instalacion' })
  @IsString() @IsOptional() @MaxLength(2000)
  sourceUrl?: string;

  @ApiPropertyOptional({ example: '# Instalación\n\nPaso 1: ...' })
  @IsString() @IsOptional()
  rawContent?: string;

  @ApiPropertyOptional({ example: ['instalacion', 'guia'] })
  @IsArray() @IsOptional()
  tags?: string[];
}
