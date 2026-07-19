// =============================================================================
// modules/manzana/manzana.module.ts
// Módulo NestJS para el proyecto MANZANA.
// Se auto-registra en el ProjectStrategyRegistry al inicializar.
//
// Para integrar el proyecto real:
// 1. Agregar HttpModule o cliente gRPC del proyecto en imports
// 2. Inyectar el cliente en MANZANAStrategy
// 3. Completar enrichContext y afterResponse en la strategy
// 4. Completar MANZANA_CONFIG con el prompt y configuración real
// =============================================================================

import { Module, OnModuleInit }       from '@nestjs/common';
import { MANZANAStrategy }  from './manzana.strategy';
import { ProjectStrategyRegistry }    from '../../core/strategies/project-strategy.registry';

@Module({
  providers: [MANZANAStrategy],
  exports:   [MANZANAStrategy],
})
export class MANZANAModule implements OnModuleInit {
  constructor(
    private readonly strategy: MANZANAStrategy,
    private readonly registry: ProjectStrategyRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.strategy);
  }
}
