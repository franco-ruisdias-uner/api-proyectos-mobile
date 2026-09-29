# Imagen de la API (AGENTS §16.1). Multietapa: dependencias → build → final chica.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV CI=true
# Por si better-sqlite3 no encuentra un binario precompilado para esta plataforma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build && pnpm prune --prod

FROM node:24-bookworm-slim AS final
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Las carpetas de los volúmenes tienen que ser de `node` antes de USER node: si no, Docker las
# monta como root y la API no puede escribir la base ni las fotos.
RUN mkdir -p /app/datos /app/archivos && chown -R node:node /app/datos /app/archivos
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
