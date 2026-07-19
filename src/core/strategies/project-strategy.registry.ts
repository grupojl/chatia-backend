// =============================================================================
// core/strategies/project-strategy.registry.ts
// Registro central de estrategias por ProjectType.
// El core llama siempre la misma interfaz — el registry resuelve cuál usar.
//
// Si no hay estrategia registrada para un tipo, devuelve GenericStrategy
// para evitar que el core falle silenciosamente.
// =============================================================================

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ProjectStrategy }             from './project-strategy.interface';
import { ProjectType }                      from './project-context.interface';

@Injectable()
export class ProjectStrategyRegistry implements OnModuleInit {
  private readonly logger = new Logger(ProjectStrategyRegistry.name);
  private readonly strategies = new Map<ProjectType, ProjectStrategy>();

  onModuleInit(): void {
    this.logger.log(
      `Registry inicializado con estrategias: [${[...this.strategies.keys()].join(', ')}]`,
    );
  }

  register(strategy: ProjectStrategy): void {
    const type = strategy.getProjectType();
    this.strategies.set(type, strategy);
    this.logger.log(`Estrategia registrada: ${type}`);
  }

  get(type: ProjectType): ProjectStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      this.logger.warn(
        `No hay estrategia para ProjectType "${type}" — usando GENERIC`,
      );
      const generic = this.strategies.get(ProjectType.GENERIC);
      if (!generic) {
        throw new Error(
          `GenericStrategy no registrada. Verificar ProjectStrategyModule.`,
        );
      }
      return generic;
    }
    return strategy;
  }

  has(type: ProjectType): boolean {
    return this.strategies.has(type);
  }
}
