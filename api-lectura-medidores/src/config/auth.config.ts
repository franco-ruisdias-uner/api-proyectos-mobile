import { type ConfigType, registerAs } from '@nestjs/config';
import { type Env, validateEnv } from './env.validation.js';

// Las sesiones: la clave con la que se firman los tokens.

export function buildAuthConfig(env: Env) {
  return { jwtSecret: env.JWT_SECRET };
}

export const authConfig = registerAs('auth', () =>
  buildAuthConfig(validateEnv(process.env)),
);
export type AuthConfig = ConfigType<typeof authConfig>;
