// src/assistant/config/assistant-config.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAssistantConfigDto } from './dto/assistant-config.dto';

const DEFAULT_SYSTEM_PROMPT = `Sos un asistente virtual. Respondé de forma amigable, breve y en español.

Reglas:
- Nunca inventes información que no tenés
- Si no sabés algo, decilo claramente
- Sé empático y proactivo`;

@Injectable()
export class AssistantConfigService {
  private readonly logger = new Logger(AssistantConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(projectId: string, organizationId: string) {
    const existing = await this.prisma.assistantConfig.findUnique({
      where: { projectId },
    });
    if (existing) return existing;

    const created = await this.prisma.assistantConfig.create({
      data: { projectId, organizationId, systemPrompt: DEFAULT_SYSTEM_PROMPT },
    });
    this.logger.log(`AssistantConfig creado para proyecto ${projectId}`);
    return created;
  }

  async update(projectId: string, organizationId: string, dto: UpdateAssistantConfigDto) {
    await this.verifyOwnership(projectId, organizationId);
    return this.prisma.assistantConfig.update({ where: { projectId }, data: dto });
  }

  async toggleEnabled(projectId: string, organizationId: string, enabled: boolean) {
    await this.verifyOwnership(projectId, organizationId);
    return this.prisma.assistantConfig.update({
      where: { projectId },
      data: { isEnabled: enabled },
    });
  }

  async findByProjectSlug(slug: string, organizationId: string) {
    const project = await this.prisma.project.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
      include: { assistantConfigs: true },
    });
    if (!project) throw new NotFoundException(`Proyecto "${slug}" no encontrado`);

    const config = project.assistantConfigs[0];
    if (!config) return this.getOrCreate(project.id, organizationId);
    return config;
  }

  private async verifyOwnership(projectId: string, organizationId: string) {
    const config = await this.prisma.assistantConfig.findFirst({
      where: { projectId, organizationId },
    });
    if (!config) throw new NotFoundException('Configuración de asistente no encontrada');
    return config;
  }
}
