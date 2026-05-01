// src/assistant/dto/chat.dto.ts
import {
  IsString, IsOptional, MinLength, MaxLength, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatDto {
  @ApiProperty({ example: 'Hola, quiero info sobre un departamento en Palermo' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;

  @ApiProperty({ example: 'user-abc123', description: 'ID externo del usuario final' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  userId: string;

  @ApiPropertyOptional({
    example: 'widget',
    enum: ['api', 'widget', 'whatsapp', 'instagram', 'messenger', 'tiktok'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['api', 'widget', 'whatsapp', 'instagram', 'messenger', 'tiktok'])
  channel?: string;
}
