// src/common/common.module.ts
// Módulo que exporta servicios comunes utilizados por guards y módulos de negocio.
import { Global, Module } from '@nestjs/common';
import { EmbeddingService }     from './services/embedding.service';
import { CacheService }         from './services/cache.service';
import { EcosystemModule } from '../ecosystem/ecosystem.module';
import { GroqModule }           from '../groq/groq.module';

@Global()
@Module({
  imports: [GroqModule],
  providers: [EmbeddingService, CacheService],
  exports:   [EmbeddingService, CacheService],
})
export class CommonModule {}
