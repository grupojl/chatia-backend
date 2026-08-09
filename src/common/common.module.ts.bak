// src/common/common.module.ts
// Módulo que exporta servicios comunes utilizados por guards y módulos de negocio.
import { Global, Module } from '@nestjs/common';
import { DashboardAuthService } from './services/dashboard-auth.service';
import { EmbeddingService } from './services/embedding.service';
import { CacheService } from './services/cache.service';

@Global()
@Module({
  providers: [DashboardAuthService, EmbeddingService, CacheService],
  exports: [DashboardAuthService, EmbeddingService, CacheService],
})
export class CommonModule {}
