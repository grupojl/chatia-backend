// src/assistant/config/dto/assistant-config.dto.ts
import {
  IsString, IsOptional, IsBoolean, IsNumber, IsInt,
  MinLength, MaxLength, Min, Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAssistantConfigDto {
  @ApiPropertyOptional({ example: 'Sofía' })
  @IsString() @IsOptional() @MaxLength(50)
  personaName?: string;

  @ApiPropertyOptional({ example: 'Sos un asistente de compra de propiedades...' })
  @IsString() @IsOptional() @MinLength(1) @MaxLength(8000)
  systemPrompt?: string;

  @ApiPropertyOptional({ example: 'llama-3.3-70b-versatile' })
  @IsString() @IsOptional()
  groqModel?: string;

  @ApiPropertyOptional({ example: 0.7, minimum: 0, maximum: 2 })
  @IsNumber() @IsOptional() @Min(0) @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ example: 1024, minimum: 256, maximum: 4096 })
  @IsInt() @IsOptional() @Min(256) @Max(4096)
  maxTokens?: number;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 })
  @IsInt() @IsOptional() @Min(1) @Max(50)
  contextWindow?: number;

  @ApiPropertyOptional({ example: '¡Hola! ¿En qué te puedo ayudar hoy?' })
  @IsString() @IsOptional() @MaxLength(500)
  welcomeMessage?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional() @MaxLength(500)
  fallbackMessage?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean() @IsOptional()
  useFaqFallback?: boolean;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  faqKbId?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean() @IsOptional()
  isEnabled?: boolean;
}
