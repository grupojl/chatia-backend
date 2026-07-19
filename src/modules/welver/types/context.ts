// =============================================================================
// modules/welver/types/context.ts
// Definición del contexto de negocio específico de WELVER.
// TODO: completar businessData con los campos reales cuando se integre el proyecto.
// =============================================================================

export interface WELVERBusinessData {
  // TODO: agregar campos específicos de WELVER cuando se integre
  // Ejemplo para ecommerce: products, cart, order
  // Ejemplo para saas: plan, flags, quotas
  [key: string]: unknown;
}
