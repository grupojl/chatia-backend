// src/ai-config/dto/update-ai-config.dto.ts
import {
  IsString, IsNumber, IsBoolean, IsOptional,
  IsArray, Min, Max,
} from 'class-validator';

/**
 * DTO para actualizar la configuración de IA de un ChannelAccount.
 * Todos los campos son opcionales — se aplica patch parcial.
 */
export class UpdateAiConfigDto {
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  personaName?: string;

  @IsOptional()
  @IsString()
  groqModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(256)
  @Max(4096)
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  contextWindowSize?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  humanTakeoverKeywords?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  autoResolveAfterHours?: number;

  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  @IsOptional()
  @IsString()
  offlineMessage?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
