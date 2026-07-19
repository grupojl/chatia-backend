// =============================================================================
// modules/welver/welver.module.ts
// Módulo NestJS para el proyecto WELVER.
// Se auto-registra en el ProjectStrategyRegistry al inicializar.
//
// Para integrar el proyecto real:
// 1. Agregar HttpModule o cliente gRPC del proyecto en imports
// 2. Inyectar el cliente en WELVERStrategy
// 3. Completar enrichContext y afterResponse en la strategy
// 4. Completar WELVER_CONFIG con el prompt y configuración real
// =============================================================================

import { Module, OnModuleInit }       from '@nestjs/common';
import { WELVERStrategy }  from './welver.strategy';
import { ProjectStrategyRegistry }    from '../../core/strategies/project-strategy.registry';

@Module({
  providers: [WELVERStrategy],
  exports:   [WELVERStrategy],
})
export class WELVERModule implements OnModuleInit {
  constructor(
    private readonly strategy: WELVERStrategy,
    private readonly registry: ProjectStrategyRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.strategy);
  }
}
