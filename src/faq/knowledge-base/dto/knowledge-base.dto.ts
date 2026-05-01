// src/faq/knowledge-base/dto/knowledge-base.dto.ts
import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateKnowledgeBaseDto {
  @ApiProperty({ example: 'Documentación del producto' })
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional() @MaxLength(500)
  description?: string;
}

export class UpdateKnowledgeBaseDto {
  @ApiPropertyOptional()
  @IsString() @IsOptional() @MinLength(2) @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional() @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean() @IsOptional()
  isActive?: boolean;
}
