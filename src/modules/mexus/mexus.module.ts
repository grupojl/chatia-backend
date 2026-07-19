// =============================================================================
// modules/mexus/mexus.module.ts
// Módulo NestJS para el proyecto MEXUS.
// Se auto-registra en el ProjectStrategyRegistry al inicializar.
//
// Para integrar el proyecto real:
// 1. Agregar HttpModule o cliente gRPC del proyecto en imports
// 2. Inyectar el cliente en MEXUSStrategy
// 3. Completar enrichContext y afterResponse en la strategy
// 4. Completar MEXUS_CONFIG con el prompt y configuración real
// =============================================================================

import { Module, OnModuleInit }       from '@nestjs/common';
import { MEXUSStrategy }  from './mexus.strategy';
import { ProjectStrategyRegistry }    from '../../core/strategies/project-strategy.registry';

@Module({
  providers: [MEXUSStrategy],
  exports:   [MEXUSStrategy],
})
export class MEXUSModule implements OnModuleInit {
  constructor(
    private readonly strategy: MEXUSStrategy,
    private readonly registry: ProjectStrategyRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.strategy);
  }
}
