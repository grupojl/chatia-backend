// src/faq/query/dto/faq-query.dto.ts
import { IsString, IsOptional, IsInt, IsBoolean, Min, Max, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FaqQueryDto {
  @ApiProperty({ example: '¿Cómo instalo el producto?' })
  @IsString() @MinLength(3)
  question: string;

  @ApiProperty({ example: 'kb-abc123' })
  @IsString()
  kbId: string;

  @ApiPropertyOptional({ default: 5 })
  @IsInt() @IsOptional() @Min(1) @Max(20)
  topK?: number;

  @ApiPropertyOptional({ default: false, description: 'Si true, genera respuesta RAG con Groq' })
  @IsBoolean() @IsOptional()
  includeAnswer?: boolean;
}
