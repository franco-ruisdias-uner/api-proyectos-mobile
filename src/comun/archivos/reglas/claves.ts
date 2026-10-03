import { aleatorio } from '../../ids/ids.js';
import { anioYMesEnZona } from '../../fechas/fechas.js';
import type { TipoArchivo } from './tipos-archivo.js';

const CARPETA: Record<TipoArchivo, string> = {
  imagen: 'imagenes',
  audio: 'audios',
  video: 'videos',
};

const CLAVE_VALIDA =
  /^(imagenes|audios|videos)\/\d{4}\/\d{2}\/[a-z0-9]{8,40}\.(jpg|png|webp|m4a|aac|mp3|mp4)$/;

/** `imagenes/2026/10/<16 caracteres>.jpg`. La genera el servidor; nunca se reutiliza. */
export function nuevaClave(tipo: TipoArchivo, ext: string, ahora: Date): string {
  const { anio, mes } = anioYMesEnZona(ahora);
  return `${CARPETA[tipo]}/${anio}/${String(mes).padStart(2, '0')}/${aleatorio(16)}.${ext}`;
}

export function esClaveValida(clave: string): boolean {
  return CLAVE_VALIDA.test(clave);
}

/** De una URL `<origen>/archivos/<clave>` saca la clave; si no es de esta API, null. */
export function claveDesdeUrl(url: string): string | null {
  let parseada: URL;
  try {
    parseada = new URL(url);
  } catch {
    return null;
  }
  if (parseada.protocol !== 'http:' && parseada.protocol !== 'https:') return null;
  const m = /^\/archivos\/(.+)$/.exec(parseada.pathname);
  if (!m || !esClaveValida(m[1])) return null;
  return m[1];
}
