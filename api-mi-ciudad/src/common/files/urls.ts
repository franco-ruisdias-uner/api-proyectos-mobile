import { origenActual } from '../context/request-context.js';
import { esClaveValida } from './keys.js';

/** Clave guardada en la base → URL absoluta que usa el teléfono (AGENTS §8). */
export function urlDeArchivo(clave: string): string {
  return `${origenActual()}/archivos/${clave}`;
}

export function urlDeArchivoONulo(clave: string | null): string | null {
  return clave === null ? null : urlDeArchivo(clave);
}

/**
 * URL que mandó el teléfono → clave, si tiene la forma de un archivo de esta API
 * (`http(s)://<host>/archivos/<clave>`). `file://`, URLs de otros sitios o claves raras: `null`.
 * Que la clave exista se chequea aparte, contra el almacén.
 */
export function claveDeUrl(url: string): string | null {
  let parseada: URL;
  try {
    parseada = new URL(url);
  } catch {
    return null;
  }
  if (parseada.protocol !== 'http:' && parseada.protocol !== 'https:') return null;
  const prefijo = '/archivos/';
  if (!parseada.pathname.startsWith(prefijo)) return null;
  const clave = decodeURIComponent(parseada.pathname.slice(prefijo.length));
  return esClaveValida(clave) ? clave : null;
}
