# Imagen de la API (AGENTS §16.1). Multietapa sobre node:24-bookworm-slim.

# 1. deps: dependencias (con herramientas por si better-sqlite3 tiene que compilarse)
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 2. build: compila y deja sólo las dependencias de producción
FROM deps AS build
COPY . .
RUN pnpm build && CI=true pnpm prune --prod

# 3. final: lo mínimo para correr
FROM node:24-bookworm-slim AS final
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/seeds/media ./src/seeds/media
# Las carpetas de los volúmenes, del usuario node antes de dejar de ser root: si no, los
# volúmenes se montan como root y la API no puede escribir la base ni las fotos.
RUN mkdir -p /app/data /app/uploads && chown -R node:node /app/data /app/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# `node` directo y no `npm start`: npm no le pasa a la app las señales de Docker (SIGTERM al
# hacer `docker compose down`) y la API no podría cerrar la base con orden. Es lo mismo que
# `pnpm start:prod`.
CMD ["node", "dist/src/main.js"]
