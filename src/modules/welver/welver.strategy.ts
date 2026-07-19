// =============================================================================
// modules/welver/welver.strategy.ts
// Estrategia de WELVER — implementa ProjectStrategy.
//
// enrichContext → TODO: llamar a la API de WELVER para traer contexto
// afterResponse → TODO: implementar side-effects específicos del proyecto
//
// IMPORTANTE: enrichContext nunca debe romper el flujo. Si falla, loguea y
// devuelve contexto vacío para que el core responda de todas formas.
// =============================================================================

import { Injectable, Logger }    from '@nestjs/common';
import type { AssistantSession } from '@prisma/client';

import type { ProjectStrategy }           from '../../core/strategies/project-strategy.interface';
import { ProjectContext, ProjectType }    from '../../core/strategies/project-context.interface';
import { WELVER_CONFIG }        from './welver.config';

@Injectable()
export class WELVERStrategy implements ProjectStrategy {
  private readonly logger = new Logger(WELVERStrategy.name);

  getProjectType(): ProjectType {
    return ProjectType.WELVER;
  }

  async enrichContext(
    message: string,
    projectId: string,
    organizationId: string,
  ): Promise<ProjectContext> {
    try {
      // TODO: llamar a la API de WELVER para enriquecer el contexto
      // Ejemplo:
      // const data = await this.welverClient.getContextForMessage(message, projectId);

      return {
        businessData: {
          // TODO: mapear datos de WELVER aquí
        },
        systemPromptAddons: WELVER_CONFIG.systemPrompt,
        meta: {
          projectType: ProjectType.WELVER,
          projectId,
          organizationId,
          enrichedAt: new Date(),
        },
      };
    } catch (error) {
      // enrichContext nunca rompe el flujo — devuelve contexto vacío
      this.logger.error(
        `Error enriqueciendo contexto WELVER: ${(error as Error).message}`,
      );
      return {
        businessData: {},
        systemPromptAddons: '',
        meta: {
          projectType: ProjectType.WELVER,
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
      // TODO: implementar side-effects específicos de WELVER
      // Ejemplo:
      // - actualizar estado de orden
      // - registrar métricas de negocio
      // - disparar webhooks del proyecto
      this.logger.debug(
        `afterResponse WELVER — projectId: ${context.meta.projectId}`,
      );
    } catch (error) {
      // afterResponse nunca rompe el flujo — solo loguea
      this.logger.error(
        `Error en afterResponse WELVER: ${(error as Error).message}`,
      );
    }
  }
}
