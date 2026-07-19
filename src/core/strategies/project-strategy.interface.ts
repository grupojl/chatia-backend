// =============================================================================
// core/strategies/project-strategy.interface.ts
// Contrato que cada módulo de proyecto DEBE implementar.
//
// enrichContext  → se llama ANTES de enviar al LLM, inyecta datos de negocio
// afterResponse  → se llama DESPUÉS de recibir respuesta, permite side-effects
// getProjectType → identifica el tipo para el registry
// =============================================================================

import type { ProjectContext, ProjectType } from './project-context.interface';
import type { AssistantSession }            from '@prisma/client';

export interface ProjectStrategy {
  /**
   * Enriquece el contexto con datos de negocio del proyecto.
   * Se llama antes de enviar el mensaje al LLM.
   * Si falla, debe devolver un contexto vacío — nunca romper el flujo principal.
   */
  enrichContext(
    message: string,
    projectId: string,
    organizationId: string,
  ): Promise<ProjectContext>;

  /**
   * Hook post-respuesta. Permite acciones como:
   * - actualizar estado de orden
   * - registrar métricas de negocio
   * - disparar webhooks del proyecto
   * Si falla, solo loguea — nunca rompe el flujo.
   */
  afterResponse(
    response: string,
    context: ProjectContext,
    session: AssistantSession,
  ): Promise<void>;

  /**
   * Identifica el tipo de proyecto para el registry.
   */
  getProjectType(): ProjectType;
}
