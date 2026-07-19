// =============================================================================
// modules/mexus/mexus.strategy.ts
// Estrategia de MEXUS — implementa ProjectStrategy.
//
// enrichContext → TODO: llamar a la API de MEXUS para traer contexto
// afterResponse → TODO: implementar side-effects específicos del proyecto
//
// IMPORTANTE: enrichContext nunca debe romper el flujo. Si falla, loguea y
// devuelve contexto vacío para que el core responda de todas formas.
// =============================================================================

import { Injectable, Logger }    from '@nestjs/common';
import type { AssistantSession } from '@prisma/client';

import type { ProjectStrategy }           from '../../core/strategies/project-strategy.interface';
import { ProjectContext, ProjectType }    from '../../core/strategies/project-context.interface';
import { MEXUS_CONFIG }        from './mexus.config';

@Injectable()
export class MEXUSStrategy implements ProjectStrategy {
  private readonly logger = new Logger(MEXUSStrategy.name);

  getProjectType(): ProjectType {
    return ProjectType.MEXUS;
  }

  async enrichContext(
    message: string,
    projectId: string,
    organizationId: string,
  ): Promise<ProjectContext> {
    try {
      // TODO: llamar a la API de MEXUS para enriquecer el contexto
      // Ejemplo:
      // const data = await this.mexusClient.getContextForMessage(message, projectId);

      return {
        businessData: {
          // TODO: mapear datos de MEXUS aquí
        },
        systemPromptAddons: MEXUS_CONFIG.systemPrompt,
        meta: {
          projectType: ProjectType.MEXUS,
          projectId,
          organizationId,
          enrichedAt: new Date(),
        },
      };
    } catch (error) {
      // enrichContext nunca rompe el flujo — devuelve contexto vacío
      this.logger.error(
        `Error enriqueciendo contexto MEXUS: ${(error as Error).message}`,
      );
      return {
        businessData: {},
        systemPromptAddons: '',
        meta: {
          projectType: ProjectType.MEXUS,
          projectId,
          organizationId,
          enrichedAt: new Date(),
        },
      };
    }
  }

  async afterResponse(
    response: string,
    context: ProjectContext,
    _session: AssistantSession,
  ): Promise<void> {
    try {
      // TODO: implementar side-effects específicos de MEXUS
      // Ejemplo:
      // - actualizar estado de orden
      // - registrar métricas de negocio
      // - disparar webhooks del proyecto
      this.logger.debug(
        `afterResponse MEXUS — projectId: ${context.meta.projectId}`,
      );
    } catch (error) {
      // afterResponse nunca rompe el flujo — solo loguea
      this.logger.error(
        `Error en afterResponse MEXUS: ${(error as Error).message}`,
      );
    }
  }
}
