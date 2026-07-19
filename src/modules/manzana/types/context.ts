// =============================================================================
// modules/manzana/types/context.ts
// Definición del contexto de negocio específico de MANZANA.
// TODO: completar businessData con los campos reales cuando se integre el proyecto.
// =============================================================================

export interface MANZANABusinessData {
  // TODO: agregar campos específicos de MANZANA cuando se integre
  // Ejemplo para ecommerce: products, cart, order
  // Ejemplo para saas: plan, flags, quotas
  [key: string]: unknown;
}
