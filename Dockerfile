# =============================================================================
# Build stage
# =============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencias primero (mejor cache de capas)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copiar código y compilar
COPY . .
RUN pnpm prisma generate
RUN pnpm build

# Limpiar devDependencies
RUN pnpm prune --prod

# =============================================================================
# Production stage
# =============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Usuario sin privilegios
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Solo lo necesario del builder
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/package.json  ./package.json
COPY --from=builder /app/prisma        ./prisma

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main"]
