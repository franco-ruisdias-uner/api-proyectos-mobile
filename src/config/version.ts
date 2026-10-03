import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Versión de package.json (sirve igual desde src/ en los tests y desde dist/ en producción). */
export function versionDeLaApi(): string {
  let carpeta = import.meta.dirname;
  for (let i = 0; i < 6; i++) {
    const ruta = join(carpeta, 'package.json');
    if (existsSync(ruta)) {
      return (JSON.parse(readFileSync(ruta, 'utf8')) as { version?: string }).version ?? '0.0.0';
    }
    carpeta = dirname(carpeta);
  }
  return '0.0.0';
}
