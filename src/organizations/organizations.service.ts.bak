// src/organizations/organizations.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Garantiza que la organización existe localmente.
   * Se llama en cada request desde TenantGuard — debe ser muy rápida.
   * Si la org ya existe y no cambió, no genera ninguna query de escritura.
   */
  async ensureExists(id: string, name: string, slug: string): Promise<void> {
    try {
      await this.prisma.organization.upsert({
        where: { id },
        create: { id, name, slug, isActive: true },
        update: { name, slug }, // actualiza nombre/slug si cambiaron en el dashboard
      });
    } catch (err) {
      // Nunca debe romper el flujo principal
      this.logger.warn(`No se pudo upsert Organization ${id}: ${err}`);
    }
  }

  async findOne(id: string) {
    return this.prisma.organization.findUnique({ where: { id } });
  }
}
