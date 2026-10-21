import { nuevoId } from '../ids/ids.js';
import type { ArchivoDetectado } from './signatures.js';

const CARPETAS = { imagen: 'imagenes', audio: 'audios', video: 'videos' } as const;

/** `<imagenes|audios|videos>/<AAAA>/<MM>/<id aleatorio>.<ext>`: la genera siempre el servidor. */
export function nuevaClave(archivo: ArchivoDetectado, ahora: Date): string {
  const anio = ahora.getUTCFullYear();
  const mes = String(ahora.getUTCMonth() + 1).padStart(2, '0');
  const id = nuevoId('a').slice(2);
  return `${CARPETAS[archivo.tipo]}/${anio}/${mes}/${id}.${archivo.extension}`;
}

const CLAVE_VALIDA =
  /^(imagenes|audios|videos)\/\d{4}\/\d{2}\/[a-z0-9-]{3,60}\.(jpg|png|webp|m4a|aac|mp3|mp4)$/;

export function esClaveValida(clave: string): boolean {
  return CLAVE_VALIDA.test(clave);
}

const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};

export function mimeDeClave(clave: string): string {
  return MIME_POR_EXTENSION[clave.slice(clave.lastIndexOf('.') + 1)] ?? 'application/octet-stream';
}
