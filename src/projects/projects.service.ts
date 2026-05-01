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
