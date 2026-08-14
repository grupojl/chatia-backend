#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix projects.service.ts: slug auto-generado correctamente
# USO (desde raíz de chat-ia-lang):
#   bash x.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

section "Reescribir projects.service.ts"

cat > src/projects/projects.service.ts << 'EOF'
// src/projects/projects.service.ts
import {
  Injectable, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateProjectDto) {
    // Generar slug desde name si no viene en el DTO
    if (!dto.slug) {
      dto.slug = dto.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 60);
    }

    const existing = await this.prisma.project.findUnique({
      where: { organizationId_slug: { organizationId, slug: dto.slug } },
    });
    if (existing) {
      throw new ConflictException(`Ya existe un proyecto con el slug "${dto.slug}"`);
    }

    const project = await this.prisma.project.create({
      data: { ...dto, organizationId },
    });

    this.logger.log(`Proyecto creado: ${project.id} (${project.slug})`);
    return { success: true, data: project };
  }

  async findAll(organizationId: string) {
    const projects = await this.prisma.project.findMany({
      where: { organizationId },
      include: {
        _count: { select: { assistantConfigs: true, knowledgeBases: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: projects };
  }

  async findOne(slug: string, organizationId: string) {
    const project = await this.prisma.project.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
      include: {
        assistantConfigs: {
          select: { id: true, personaName: true, isEnabled: true, groqModel: true },
        },
        knowledgeBases: {
          select: { id: true, name: true, isActive: true },
          where: { isActive: true },
        },
      },
    });
    if (!project) throw new NotFoundException(`Proyecto "${slug}" no encontrado`);
    return { success: true, data: project };
  }

  async findOneById(id: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  async update(slug: string, organizationId: string, dto: UpdateProjectDto) {
    await this.findOne(slug, organizationId);
    if (dto.slug && dto.slug !== slug) {
      const conflict = await this.prisma.project.findUnique({
        where: { organizationId_slug: { organizationId, slug: dto.slug } },
      });
      if (conflict) throw new ConflictException(`Ya existe un proyecto con el slug "${dto.slug}"`);
    }
    const updated = await this.prisma.project.update({
      where: { organizationId_slug: { organizationId, slug } },
      data: dto,
    });
    return { success: true, data: updated };
  }

  async remove(slug: string, organizationId: string) {
    await this.findOne(slug, organizationId);
    await this.prisma.project.delete({
      where: { organizationId_slug: { organizationId, slug } },
    });
    return { success: true, message: `Proyecto "${slug}" eliminado` };
  }
}
EOF

ok "projects.service.ts reescrito"

section "Próximos pasos"
echo ""
echo "  git add ."
echo "  git commit -m 'fix: projects.service.ts slug auto-generado'"
echo "  git push origin main"
echo ""