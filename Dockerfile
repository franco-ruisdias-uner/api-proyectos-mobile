# Imagen de la API (AGENTS §16.1). Multietapa sobre Node 24.

# ── deps: dependencias, con caché por lockfile ──────────────────────────────
FROM node:24-bookworm-slim AS deps
WORKDIR /app
# Por si better-sqlite3 no encuentra binario precompilado para esta plataforma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── build: compila y deja sólo las dependencias de producción ───────────────
FROM deps AS build
COPY . .
RUN pnpm build && pnpm prune --prod

# ── final ────────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/seeds/media ./src/seeds/media
# Las carpetas de los volúmenes, con dueño node ANTES de cambiar de usuario: si no, se
# montan como root y la API no puede escribir la base ni las fotos.
RUN mkdir -p /app/datos /app/archivos && chown -R node:node /app/datos /app/archivos
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:3000/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
