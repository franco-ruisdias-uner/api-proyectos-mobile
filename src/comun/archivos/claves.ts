// Claves de archivos (AGENTS §17.1) y su relación con las URLs públicas (AGENTS §8).
import { anioMesEnZona } from '../fechas/fechas.js';
import { textoAleatorio } from '../ids/ids.js';
import {
  carpetaDe,
  MIME_POR_EXTENSION,
  type Extension,
  type TipoArchivo,
} from './tipos-archivo.js';

const CLAVE =
  /^(imagenes|audios|videos)\/\d{4}\/\d{2}\/[a-z0-9]{8,40}\.(jpg|png|webp|m4a|aac|mp3|mp4)$/;

export const PREFIJO_RUTA = '/archivos/';

/** Clave nueva, generada por el servidor. Nunca se reutiliza. */
export function nuevaClave(
  tipo: TipoArchivo,
  extension: Extension,
  ahora: Date,
): string {
  const { anio, mes } = anioMesEnZona(ahora);
  return `${carpetaDe(tipo)}/${anio}/${mes}/${textoAleatorio(24)}.${extension}`;
}

export const esClaveValida = (clave: string): boolean => CLAVE.test(clave);

export function mimeDeClave(clave: string): string {
  const ext = clave.slice(clave.lastIndexOf('.') + 1) as Extension;
  return MIME_POR_EXTENSION[ext] ?? 'application/octet-stream';
}

/**
 * La clave de una URL de esta API (`<origen>/archivos/<clave>`), o null si no lo es:
 * otra ruta, file://, content://, una clave inválida o algo que no es una URL.
 * No mira el host: el teléfono pudo haber subido el archivo por otra IP de la misma
 * computadora. Que el archivo exista lo chequea quien la usa.
 */
export function claveDesdeUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.pathname.startsWith(PREFIJO_RUTA)) return null;
  const clave = u.pathname.slice(PREFIJO_RUTA.length);
  return esClaveValida(clave) ? clave : null;
}
