// src/assignment/assignment.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AssignmentStrategy = 'round-robin' | 'least-load';

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  // Mapa en memoria: organizationId → índice del último agente asignado
  // Solo se usa con la estrategia round-robin
  private readonly roundRobinCursors = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve el agentId a asignar, o null si no hay agentes activos.
   * Se llama al crear una conversación nueva.
   */
  async assignAgent(
    organizationId: string,
    strategy: AssignmentStrategy = 'least-load',
  ): Promise<string | null> {
    const agents = await this.prisma.agent.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' }, // orden estable para round-robin
    });

    if (!agents.length) {
      this.logger.debug(`No hay agentes activos en org ${organizationId}`);
      return null;
    }

    if (strategy === 'round-robin') {
      return this.roundRobin(organizationId, agents.map((a) => a.id));
    }

    return this.leastLoad(organizationId, agents.map((a) => a.id));
  }

  // ── Estrategias ───────────────────────────────────────────────────────────

  private roundRobin(organizationId: string, agentIds: string[]): string {
    const current = this.roundRobinCursors.get(organizationId) ?? 0;
    const next = (current + 1) % agentIds.length;
    this.roundRobinCursors.set(organizationId, next);

    const assigned = agentIds[next];
    this.logger.debug(
      `[round-robin] org:${organizationId} → agente ${assigned} (slot ${next}/${agentIds.length - 1})`,
    );
    return assigned;
  }

  private async leastLoad(organizationId: string, agentIds: string[]): Promise<string> {
    // Contar conversaciones activas (OPEN + HUMAN_TAKEOVER) por agente
    const counts = await this.prisma.conversation.groupBy({
      by: ['assignedAgentId'],
      where: {
        assignedAgentId: { in: agentIds },
        status: { in: ['OPEN', 'HUMAN_TAKEOVER'] },
      },
      _count: { id: true },
    });

    // Construir mapa agentId → carga
    const loadMap = new Map<string, number>(
      agentIds.map((id) => [id, 0]),
    );
    for (const row of counts) {
      if (row.assignedAgentId) {
        loadMap.set(row.assignedAgentId, row._count.id);
      }
    }

    // Elegir el agente con menor carga (en empate, el primero en la lista)
    let minLoad = Infinity;
    let assigned = agentIds[0];

    for (const [agentId, load] of loadMap.entries()) {
      if (load < minLoad) {
        minLoad = load;
        assigned = agentId;
      }
    }

    this.logger.debug(
      `[least-load] org:${organizationId} → agente ${assigned} (carga: ${minLoad})`,
    );
    return assigned;
  }
}
