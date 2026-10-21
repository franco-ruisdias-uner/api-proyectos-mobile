import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Versión de package.json. Se busca subiendo carpetas: anda desde src/ y desde dist/src/. */
function leerVersion(): string {
  let carpeta = import.meta.dirname;
  for (let i = 0; i < 6; i++) {
    try {
      const paquete = JSON.parse(readFileSync(resolve(carpeta, 'package.json'), 'utf8')) as {
        name?: string;
        version?: string;
      };
      if (paquete.name === 'api-transporte-publico' && paquete.version) return paquete.version;
    } catch {
      // no hay package.json en esta carpeta: seguimos subiendo
    }
    carpeta = resolve(carpeta, '..');
  }
  return '0.0.0';
}

export const VERSION = leerVersion();
