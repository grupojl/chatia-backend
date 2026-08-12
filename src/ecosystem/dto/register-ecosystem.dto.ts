// src/ecosystem/dto/register-ecosystem.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterEcosystemDto {
  @ApiProperty({ example: 'welver-firebase-project-id' })
  @IsString()
  @IsNotEmpty()
  firebaseProjectId: string;

  @ApiProperty({ example: 'Welver' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: { maxProjects: 50, features: { faq: true, channels: true } },
  })
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}
