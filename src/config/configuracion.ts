import { ConfigModule, ConfigService } from '@nestjs/config';
import { type Entorno, leerEntorno } from './entorno.js';

export type Configuracion = ConfigService<Entorno, true>;

/** Lee la configuración de `variables` (por defecto, process.env) y la valida. */
export function moduloDeConfiguracion(
  variables: Record<string, string | undefined>,
) {
  return ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: true, // el .env lo carga main.ts antes de importar nada
    ignoreEnvVars: true,
    validate: () =>
      leerEntorno(variables) as unknown as Record<string, unknown>,
  });
}

export function valor<K extends keyof Entorno>(
  config: Configuracion,
  clave: K,
): Entorno[K] {
  return config.get(clave, { infer: true });
}
