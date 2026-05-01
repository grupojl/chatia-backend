// src/channel-accounts/channel-accounts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelType, Prisma } from '@prisma/client';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { randomUUID } from 'crypto';

export class CreateChannelAccountDto {
  @IsEnum(ChannelType)
  channelType: ChannelType;

  @IsString()
  name: string;

  @IsString()
  externalId: string;

  @IsString()
  accessToken: string;

  @IsOptional()
  extraConfig?: Record<string, unknown>;
}

export class UpdateChannelAccountDto {
  @IsString() @IsOptional()
  name?: string;

  @IsString() @IsOptional()
  accessToken?: string;

  @IsOptional()
  extraConfig?: Record<string, unknown>;
}

@Injectable()
export class ChannelAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateChannelAccountDto) {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

    const account = await this.prisma.channelAccount.create({
      data: {
        organizationId,
        channelType: dto.channelType,
        name: dto.name,
        externalId: dto.externalId,
        accessToken: dto.accessToken,
        extraConfig: (dto.extraConfig ?? {}) as Prisma.InputJsonValue,
        webhookVerifyToken: randomUUID(),
      },
    });

    return {
      success: true,
      data: {
        ...account,
        webhookUrl: `${appUrl}/api/v1/webhooks/${dto.channelType.toLowerCase()}/${dto.externalId}`,
      },
    };
  }

  async list(organizationId: string) {
    const accounts = await this.prisma.channelAccount.findMany({
      where: { organizationId },
      include: {
        aiConfig: { select: { isEnabled: true, personaName: true } },
        _count: { select: { conversations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: accounts };
  }

  async findOne(id: string, organizationId: string) {
    const account = await this.prisma.channelAccount.findFirst({
      where: { id, organizationId },
      include: { aiConfig: true },
    });

    if (!account) throw new NotFoundException('Cuenta no encontrada');
    return { success: true, data: account };
  }

  async update(id: string, organizationId: string, dto: UpdateChannelAccountDto) {
    const account = await this.prisma.channelAccount.findFirst({
      where: { id, organizationId },
    });

    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const updated = await this.prisma.channelAccount.update({
      where: { id },
      data: {
        ...(dto.name        !== undefined && { name: dto.name }),
        ...(dto.accessToken !== undefined && { accessToken: dto.accessToken }),
        ...(dto.extraConfig !== undefined && {
          extraConfig: dto.extraConfig as Prisma.InputJsonValue,
        }),
      },
    });

    return { success: true, data: updated };
  }

  async rotateToken(id: string, organizationId: string) {
    const account = await this.prisma.channelAccount.findFirst({
      where: { id, organizationId },
    });

    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const updated = await this.prisma.channelAccount.update({
      where: { id },
      data: { webhookVerifyToken: randomUUID() },
    });

    return {
      success: true,
      message: 'Token rotado. Actualizá el webhook en el panel del canal.',
      data: { webhookVerifyToken: updated.webhookVerifyToken },
    };
  }
}