// =============================================================================
// core/strategies/generic.strategy.ts
// Estrategia fallback cuando el proyecto no tiene módulo específico.
// No enriquece contexto ni ejecuta side-effects — pasa el mensaje directo al LLM.
// =============================================================================

import { Injectable }                                        from '@nestjs/common';
import type { ProjectStrategy }                              from './project-strategy.interface';
import { ProjectContext, ProjectType }                       from './project-context.interface';
import type { AssistantSession }                             from '@prisma/client';

@Injectable()
export class GenericStrategy implements ProjectStrategy {
  getProjectType(): ProjectType {
    return ProjectType.GENERIC;
  }

  async enrichContext(
    _message: string,
    projectId: string,
    organizationId: string,
  ): Promise<ProjectContext> {
    return {
      businessData: {},
      systemPromptAddons: '',
      meta: {
        projectType: ProjectType.GENERIC,
        projectId,
        organizationId,
        enrichedAt: new Date(),
      },
    };
  }

  async afterResponse(
    _response: string,
    _context: ProjectContext,
    _session: AssistantSession,
  ): Promise<void> {
    // generic no ejecuta side-effects
  }
}
