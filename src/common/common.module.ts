// src/common/common.module.ts
//
// Módulo global — exporta servicios comunes y EcosystemModule.
// Al ser @Global() + exportar EcosystemModule, EcosystemService queda
// disponible en TODOS los módulos sin necesidad de importarlo individualmente.
// Esto es necesario porque TenantGuard inyecta EcosystemService y se usa
// en controllers de múltiples módulos.
import { Global, Module } from '@nestjs/common';
import { EmbeddingService } from './services/embedding.service';
import { CacheService }     from './services/cache.service';
import { EcosystemModule }  from '../ecosystem/ecosystem.module';
import { GroqModule }       from '../groq/groq.module';

@Global()
@Module({
  imports:   [GroqModule, EcosystemModule],
  providers: [EmbeddingService, CacheService],
  exports:   [EmbeddingService, CacheService, EcosystemModule],
})
export class CommonModule {}
