import { randomInt } from 'node:crypto';
import { format } from 'date-fns';
import { tz } from '@date-fns/tz';
import { ZONA } from '../dates/dates.js';
import type { TipoDeArchivo } from './signature.js';

const CARPETAS: Record<TipoDeArchivo, string> = {
  imagen: 'imagenes',
  audio: 'audios',
  video: 'videos',
};
const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** <imagenes|audios|videos>/<AAAA>/<MM>/<id aleatorio>.<ext> — la genera el servidor. */
export function nuevaClave(tipo: TipoDeArchivo, extension: string, ahora: Date): string {
  let id = '';
  for (let i = 0; i < 24; i++) id += ALFABETO[randomInt(ALFABETO.length)];
  return `${CARPETAS[tipo]}/${format(ahora, 'yyyy/MM', { in: tz(ZONA) })}/${id}.${extension}`;
}

const CLAVE_VALIDA =
  /^(imagenes|audios|videos)\/\d{4}\/\d{2}\/[a-z0-9]{8,64}\.(jpg|png|webp|mp3|aac|m4a|mp4)$/;

export function esClaveValida(clave: string): boolean {
  return CLAVE_VALIDA.test(clave);
}

/**
 * Si la URL es de un archivo servido por esta API (…/archivos/<clave>), devuelve la clave.
 * Cualquier otra cosa (otro sitio, file://, una clave inventada) → null.
 */
export function claveDeUrl(url: string): string | null {
  let direccion: URL;
  try {
    direccion = new URL(url);
  } catch {
    return null;
  }
  if (direccion.protocol !== 'http:' && direccion.protocol !== 'https:') return null;
  const partes = /^\/archivos\/(.+)$/.exec(direccion.pathname);
  if (!partes || !esClaveValida(partes[1])) return null;
  return partes[1];
}
