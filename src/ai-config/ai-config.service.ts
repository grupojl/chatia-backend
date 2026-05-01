// src/ai-config/ai-config.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  IsString, IsOptional, IsBoolean, IsNumber, IsInt,
  IsArray, Min, Max, MaxLength, MinLength,
} from 'class-validator';

export class UpdateAiConfigDto {
  @IsString() @IsOptional() @MinLength(1) @MaxLength(4000)
  systemPrompt?: string;

  @IsString() @IsOptional() @MaxLength(50)
  personaName?: string;

  @IsString() @IsOptional()
  groqModel?: string;

  @IsNumber() @IsOptional() @Min(0) @Max(2)
  temperature?: number;

  @IsInt() @IsOptional() @Min(256) @Max(4096)
  maxTokens?: number;

  @IsInt() @IsOptional() @Min(1) @Max(50)
  contextWindowSize?: number;

  @IsArray() @IsOptional()
  humanTakeoverKeywords?: string[];

  @IsInt() @IsOptional() @Min(1) @Max(168)
  autoResolveAfterHours?: number;

  @IsString() @IsOptional() @MaxLength(500)
  welcomeMessage?: string;

  @IsString() @IsOptional() @MaxLength(500)
  offlineMessage?: string;

  @IsBoolean() @IsOptional()
  isEnabled?: boolean;
}

const DEFAULT_SYSTEM_PROMPT = `Sos un asistente virtual. Tu objetivo es atender consultas de forma amigable y profesional.

Reglas:
- Respondé siempre en español, de forma conversacional y breve
- Sé empático y proactivo en ofrecer ayuda`;

@Injectable()
export class AiConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(channelAccountId: string, organizationId: string) {
    await this.verifyOwnership(channelAccountId, organizationId);

    const existing = await this.prisma.aiConfig.findUnique({
      where: { channelAccountId },
    });

    if (existing) return { success: true, data: existing };

    const created = await this.prisma.aiConfig.create({
      data: {
        channelAccountId,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        personaName: 'Asistente',
      },
    });

    return { success: true, data: created };
  }

  async update(channelAccountId: string, organizationId: string, dto: UpdateAiConfigDto) {
    await this.verifyOwnership(channelAccountId, organizationId);

    const config = await this.prisma.aiConfig.upsert({
      where: { channelAccountId },
      create: {
        channelAccountId,
        systemPrompt: dto.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        personaName: dto.personaName ?? 'Asistente',
        groqModel: dto.groqModel ?? 'llama-3.3-70b-versatile',
        temperature: dto.temperature ?? 0.7,
        maxTokens: dto.maxTokens ?? 1024,
        contextWindowSize: dto.contextWindowSize ?? 10,
        humanTakeoverKeywords: dto.humanTakeoverKeywords ?? [],
        autoResolveAfterHours: dto.autoResolveAfterHours ?? 24,
        welcomeMessage: dto.welcomeMessage,
        offlineMessage: dto.offlineMessage,
        isEnabled: dto.isEnabled ?? true,
      },
      update: {
        ...(dto.systemPrompt      !== undefined && { systemPrompt: dto.systemPrompt }),
        ...(dto.personaName       !== undefined && { personaName: dto.personaName }),
        ...(dto.groqModel         !== undefined && { groqModel: dto.groqModel }),
        ...(dto.temperature       !== undefined && { temperature: dto.temperature }),
        ...(dto.maxTokens         !== undefined && { maxTokens: dto.maxTokens }),
        ...(dto.contextWindowSize !== undefined && { contextWindowSize: dto.contextWindowSize }),
        ...(dto.humanTakeoverKeywords !== undefined && { humanTakeoverKeywords: dto.humanTakeoverKeywords }),
        ...(dto.autoResolveAfterHours !== undefined && { autoResolveAfterHours: dto.autoResolveAfterHours }),
        ...(dto.welcomeMessage    !== undefined && { welcomeMessage: dto.welcomeMessage }),
        ...(dto.offlineMessage    !== undefined && { offlineMessage: dto.offlineMessage }),
        ...(dto.isEnabled         !== undefined && { isEnabled: dto.isEnabled }),
      },
    });

    return { success: true, data: config };
  }

  async toggleEnabled(channelAccountId: string, organizationId: string, enabled: boolean) {
    await this.verifyOwnership(channelAccountId, organizationId);

    const config = await this.prisma.aiConfig.update({
      where: { channelAccountId },
      data: { isEnabled: enabled },
    });

    return {
      success: true,
      message: `IA ${enabled ? 'habilitada' : 'deshabilitada'} exitosamente`,
      data: config,
    };
  }

  private async verifyOwnership(channelAccountId: string, organizationId: string) {
    const account = await this.prisma.channelAccount.findFirst({
      where: { id: channelAccountId, organizationId },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    return account;
  }
}
