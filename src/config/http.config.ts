import { type ConfigType, registerAs } from '@nestjs/config';
import { type Env, validateEnv } from './env.validation.js';

// Todo lo que tiene que ver con cómo llegan los pedidos: proxy, CORS y límite de pedidos.

/** `*` (o vacío) habilita cualquier origen; si no, una lista separada por comas. */
function parseOrigins(value: string): '*' | string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin !== '');
  return origins.length === 0 || origins.includes('*') ? '*' : origins;
}

export function buildHttpConfig(env: Env) {
  return {
    /** true detrás de un proxy que pone X-Forwarded-* (Render, Koyeb). */
    trustProxy: env.TRUST_PROXY,
    /** Dirección pública de la API, o null para usar la del pedido. */
    publicUrl: env.PUBLIC_URL ?? null,
    corsOrigins: parseOrigins(env.CORS_ORIGINS),
    throttle: {
      ttlMs: env.THROTTLE_TTL_SECONDS * 1000,
      limit: env.THROTTLE_LIMIT,
      loginLimit: env.LOGIN_THROTTLE_LIMIT,
    },
  };
}

export const httpConfig = registerAs('http', () =>
  buildHttpConfig(validateEnv(process.env)),
);
export type HttpConfig = ConfigType<typeof httpConfig>;
