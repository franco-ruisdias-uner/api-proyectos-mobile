import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Versión de package.json (la API se corre siempre desde la raíz del proyecto). */
export function versionDeLaApi(): string {
  try {
    const paquete = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as {
      version?: string;
    };
    return paquete.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
