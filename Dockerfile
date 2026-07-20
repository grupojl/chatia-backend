# =============================================================================
# chat-ia-back — Dockerfile
# =============================================================================

# ── Stage 1: instalar dependencias ───────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Fijar pnpm 10 — pnpm 11 rompe con onlyBuiltDependencies en package.json
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY package.json pnpm-lock.yaml ./

# prisma/ debe estar presente ANTES de pnpm install
# para que el postinstall de @prisma/client pueda generar el client
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

# Traer node_modules ya instalados (con prisma client generado)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma       ./prisma

COPY package.json pnpm-lock.yaml nest-cli.json tsconfig.json ./
COPY prisma.config.ts ./
COPY src ./src

# Generar prisma client explícitamente (defensa en profundidad)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Compilar TypeScript
RUN pnpm build

# ── Stage 3: producción ───────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copiar node_modules del BUILDER (antes de cualquier prune)
# NO usar pnpm prune --prod: elimina @prisma/client-runtime-utils
# que es dependencia interna de Prisma 7 y rompe en runtime
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist         ./dist
COPY --from=builder --chown=appuser:appgroup /app/prisma       ./prisma
COPY --chown=appuser:appgroup package.json ./

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
