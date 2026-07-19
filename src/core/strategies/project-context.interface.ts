// =============================================================================
// core/strategies/project-context.interface.ts
// Contexto enriquecido que cada estrategia de proyecto inyecta al core IA.
// El core usa este contexto para construir el prompt y personalizar la respuesta.
// Cada proyecto implementa ProjectStrategy y rellena los campos relevantes.
// =============================================================================

export interface ProjectContext {
  /**
   * Datos de negocio específicos del proyecto.
   * Cada estrategia define su propia forma aquí.
   * El core los serializa como contexto adicional al LLM.
   */
  businessData: Record<string, unknown>;

  /**
   * Instrucciones adicionales al system prompt base.
   * La estrategia puede agregar reglas específicas del proyecto.
   */
  systemPromptAddons: string;

  /**
   * Metadatos de la sesión para logging y observabilidad.
   */
  meta: {
    projectType: ProjectType;
    projectId: string;
    organizationId: string;
    enrichedAt: Date;
  };
}

export enum ProjectType {
  WELVER   = 'WELVER',
  MANZANA  = 'MANZANA',
  MEXUS    = 'MEXUS',
  GENERIC  = 'GENERIC', // fallback cuando no hay estrategia específica
}
