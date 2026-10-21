# Imagen de la API (AGENTS §16.1). Multietapa sobre Node 24.
FROM node:24-bookworm-slim AS deps
WORKDIR /app
# Por si better-sqlite3 no encuentra un binario precompilado para esta plataforma.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build && pnpm prune --prod --ignore-scripts

FROM node:24-bookworm-slim AS final
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/seeds/media ./src/seeds/media
# Las carpetas de los volúmenes, con dueño `node` antes de cambiar de usuario: si no, Docker
# las monta como root y la API no puede escribir la base ni las fotos.
RUN mkdir -p /app/datos /app/archivos && chown -R node:node /app/datos /app/archivos
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=20s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:3000/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
