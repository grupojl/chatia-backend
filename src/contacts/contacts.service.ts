// src/contacts/contacts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ContactStatus } from '@prisma/client';
import {
  IsString, IsOptional, IsEmail, IsEnum, IsArray, IsBoolean,
} from 'class-validator';
import { PrismaService } from 'src/prisma/prisma.service';

export class UpdateContactDto {
  @IsString() @IsOptional()
  name?: string;

  @IsEmail() @IsOptional()
  email?: string;

  @IsEnum(ContactStatus) @IsOptional()
  status?: ContactStatus;

  @IsArray() @IsOptional()
  tags?: string[];

  @IsBoolean() @IsOptional()
  optedOut?: boolean;
}

export class ListContactsDto {
  @IsEnum(ContactStatus) @IsOptional()
  status?: ContactStatus;

  @IsString() @IsOptional()
  search?: string;
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, filters?: ListContactsDto) {
    const where: any = { organizationId };

    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { username: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const contacts = await this.prisma.contact.findMany({
      where,
      include: { _count: { select: { conversations: true } } },
      orderBy: { lastSeenAt: 'desc' },
    });

    return { success: true, data: contacts };
  }

  async findOne(contactId: string, organizationId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      include: {
        conversations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true, status: true, stage: true,
            lastMessageAt: true, createdAt: true,
          },
        },
      },
    });

    if (!contact) throw new NotFoundException('Contacto no encontrado');
    return { success: true, data: contact };
  }

  async update(contactId: string, organizationId: string, dto: UpdateContactDto) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
    });

    if (!contact) throw new NotFoundException('Contacto no encontrado');

    const updated = await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(dto.name      !== undefined && { name: dto.name }),
        ...(dto.email     !== undefined && { email: dto.email }),
        ...(dto.status    !== undefined && { status: dto.status }),
        ...(dto.tags      !== undefined && { tags: dto.tags }),
        ...(dto.optedOut  !== undefined && { optedOut: dto.optedOut }),
      },
    });

    return { success: true, data: updated };
  }

  async getStats(organizationId: string) {
    const [total, byStatus, optedOut] = await Promise.all([
      this.prisma.contact.count({ where: { organizationId } }),
      this.prisma.contact.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),
      this.prisma.contact.count({ where: { organizationId, optedOut: true } }),
    ]);

    return {
      success: true,
      data: {
        total,
        optedOut,
        byStatus: byStatus.reduce(
          (acc, row) => ({ ...acc, [row.status]: row._count }),
          {} as Record<string, number>,
        ),
      },
    };
  }
}
