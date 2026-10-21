import { type ConfigType, registerAs } from '@nestjs/config';
import { type Env, validateEnv } from './env.validation.js';

// Lo general de la app: en qué entorno corre, el puerto, los logs y las ayudas para probar.

export function buildAppConfig(env: Env) {
  return {
    env: env.APP_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    logFormat:
      env.LOG_FORMAT ?? (env.APP_ENV === 'production' ? 'json' : 'text'),
    /** Cabecera X-Simular (error-500, demora-3000) para probar errores y demoras. */
    simulationEnabled: env.SIMULATION_ENABLED ?? env.APP_ENV === 'development',
    /** Instante ISO en el que arranca "congelado" el reloj, o null. */
    fixedClock: env.FIXED_CLOCK ?? null,
    /** Al arrancar, si la base está vacía, carga los datos de demo. */
    seedIfEmpty: env.SEED_IF_EMPTY,
  };
}

export const appConfig = registerAs('app', () =>
  buildAppConfig(validateEnv(process.env)),
);
export type AppSettings = ConfigType<typeof appConfig>;
