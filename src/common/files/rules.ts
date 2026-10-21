// Funciones puras de archivos: tipo por firma, límites, rangos y URLs (AGENTS §8).

export type TipoArchivo = 'imagen' | 'audio' | 'video';

export interface FormatoDetectado {
  tipo: TipoArchivo;
  extension: string;
  tipoMime: string;
}

export const LIMITE_BYTES: Record<TipoArchivo, number> = {
  imagen: 5 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  video: 30 * 1024 * 1024,
};

export const CARPETA: Record<TipoArchivo, string> = {
  imagen: 'imagenes',
  audio: 'audios',
  video: 'videos',
};

function empiezaCon(b: Buffer, bytes: number[], desde = 0): boolean {
  return bytes.every((valor, i) => b[desde + i] === valor);
}

/** Mira la firma del archivo (los primeros bytes), no la extensión ni lo que dice el teléfono. */
export function detectarFormato(b: Buffer): FormatoDetectado | null {
  if (empiezaCon(b, [0xff, 0xd8, 0xff])) {
    return { tipo: 'imagen', extension: 'jpg', tipoMime: 'image/jpeg' };
  }
  if (empiezaCon(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { tipo: 'imagen', extension: 'png', tipoMime: 'image/png' };
  }
  if (
    b.toString('latin1', 0, 4) === 'RIFF' &&
    b.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return { tipo: 'imagen', extension: 'webp', tipoMime: 'image/webp' };
  }
  if (b.toString('latin1', 4, 8) === 'ftyp') {
    const marca = b.toString('latin1', 8, 12);
    if (['M4A ', 'M4B ', 'M4P '].includes(marca)) {
      return { tipo: 'audio', extension: 'm4a', tipoMime: 'audio/mp4' };
    }
    return { tipo: 'video', extension: 'mp4', tipoMime: 'video/mp4' };
  }
  if (b.toString('latin1', 0, 3) === 'ID3') {
    return { tipo: 'audio', extension: 'mp3', tipoMime: 'audio/mpeg' };
  }
  if (b.length >= 2 && b[0] === 0xff) {
    // ADTS (AAC): 1111 1111 1111 x00x; MPEG audio (MP3): 1111 1111 111x xxxx con capa ≠ 00.
    if ((b[1] & 0xf6) === 0xf0) {
      return { tipo: 'audio', extension: 'aac', tipoMime: 'audio/aac' };
    }
    if ((b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) {
      return { tipo: 'audio', extension: 'mp3', tipoMime: 'audio/mpeg' };
    }
  }
  return null;
}

/**
 * Lee la cabecera `Range` ("bytes=10-19", "bytes=10-", "bytes=-5") para un archivo de
 * `total` bytes. `undefined` si no hay cabecera o no se entiende (se manda entero);
 * `null` si el rango no se puede satisfacer (416).
 */
export function leerRango(
  cabecera: string | undefined,
  total: number,
): { inicio: number; fin: number } | null | undefined {
  if (!cabecera) return undefined;
  const partes = /^bytes=(\d*)-(\d*)$/.exec(cabecera.trim());
  if (!partes || (partes[1] === '' && partes[2] === '')) return undefined;
  if (total === 0) return null;
  let inicio: number;
  let fin: number;
  if (partes[1] === '') {
    const sufijo = Number(partes[2]);
    if (sufijo === 0) return null;
    inicio = Math.max(total - sufijo, 0);
    fin = total - 1;
  } else {
    inicio = Number(partes[1]);
    fin = partes[2] === '' ? total - 1 : Math.min(Number(partes[2]), total - 1);
  }
  if (inicio >= total || inicio > fin) return null;
  return { inicio, fin };
}

/** URL pública de un archivo: `<origen>/archivos/<clave>`. */
export function urlDeArchivo(origen: string, clave: string): string {
  return `${origen}/archivos/${clave}`;
}

/**
 * Si `url` es de un archivo de esta API (`…/archivos/<clave>`), devuelve la clave.
 * No se mira el host: el teléfono pudo haber subido la foto desde otra red (otra IP).
 */
export function claveDeUrl(url: string): string | null {
  if (!URL.canParse(url)) return null;
  const u = new URL(url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const partes = /^\/archivos\/(.+)$/.exec(u.pathname);
  return partes ? partes[1] : null;
}
