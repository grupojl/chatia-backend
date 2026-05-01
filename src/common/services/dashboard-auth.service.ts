// src/common/services/dashboard-auth.service.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DashboardUser } from '../interfaces/dashboard-user.interface';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

interface CacheEntry {
  user: DashboardUser;
  expiresAt: number;
}

@Injectable()
export class DashboardAuthService {
  private readonly logger = new Logger(DashboardAuthService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly dashboardUrl: string;

  constructor(private readonly config: ConfigService) {
    this.dashboardUrl = this.config.get<string>('DASHBOARD_URL') ?? '';
  }

  /**
   * Llama a GET {DASHBOARD_URL}/api/v1/auth/me con el Firebase token.
   * Cachea el resultado 5 minutos por UID para evitar hammering al dashboard.
   * Si el dashboard no está disponible, lanza para que el guard decida el fallback.
   */
  async getMe(firebaseToken: string, firebaseUid: string): Promise<DashboardUser> {
    // Verificar cache
    const cached = this.cache.get(firebaseUid);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    if (!this.dashboardUrl) {
      throw new Error('DASHBOARD_URL no configurado');
    }

    const response = await fetch(`${this.dashboardUrl}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedException('Token rechazado por el owner-dashboard');
    }

    if (!response.ok) {
      throw new Error(`Dashboard respondió ${response.status}`);
    }

    const user = (await response.json()) as DashboardUser;

    // Guardar en cache
    this.cache.set(firebaseUid, {
      user,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return user;
  }

  /** Invalida la entrada de cache para un UID (útil en logout o cambio de permisos) */
  invalidate(firebaseUid: string): void {
    this.cache.delete(firebaseUid);
  }

  /** Limpia entradas expiradas (llamar periódicamente si se quiere) */
  pruneCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }
}
