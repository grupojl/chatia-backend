// =============================================================================
// modules/mexus/types/context.ts
// Definición del contexto de negocio específico de MEXUS.
// TODO: completar businessData con los campos reales cuando se integre el proyecto.
// =============================================================================

export interface MEXUSBusinessData {
  // TODO: agregar campos específicos de MEXUS cuando se integre
  // Ejemplo para ecommerce: products, cart, order
  // Ejemplo para saas: plan, flags, quotas
  [key: string]: unknown;
}
