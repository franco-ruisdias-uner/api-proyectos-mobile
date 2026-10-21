import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Versión de `package.json`, buscándolo hacia arriba (sirve igual desde `src/` y desde `dist/`). */
function leerVersion(): string {
  let carpeta = import.meta.dirname;
  for (let i = 0; i < 6; i++) {
    const ruta = join(carpeta, 'package.json');
    if (existsSync(ruta)) return (JSON.parse(readFileSync(ruta, 'utf8')) as { version: string }).version;
    carpeta = dirname(carpeta);
  }
  return '0.0.0';
}

export const VERSION = leerVersion();
