// Qué se puede subir (AGENTS §8). Se mira la firma del archivo (los primeros bytes),
// no la extensión ni lo que diga el teléfono.

export type TipoArchivo = 'imagen' | 'audio' | 'video';

export interface FormatoDetectado {
  tipo: TipoArchivo;
  mime: string;
  extension: string;
}

const MB = 1024 * 1024;

export const LIMITE_BYTES: Record<TipoArchivo, number> = {
  imagen: 5 * MB,
  audio: 10 * MB,
  video: 30 * MB,
};

export const LIMITE_MAXIMO_BYTES = Math.max(...Object.values(LIMITE_BYTES));

export const CARPETA: Record<TipoArchivo, string> = {
  imagen: 'imagenes',
  audio: 'audios',
  video: 'videos',
};

const empiezaCon = (b: Buffer, firma: number[], desde = 0): boolean =>
  b.length >= desde + firma.length &&
  firma.every((byte, i) => b[desde + i] === byte);

const ascii = (b: Buffer, desde: number, largo: number): string =>
  b.length >= desde + largo
    ? b.subarray(desde, desde + largo).toString('latin1')
    : '';

/** Marcas de "ftyp" que son audio (m4a); el resto de los ISO-BMFF se toman como video mp4. */
const MARCAS_AUDIO = new Set(['M4A ', 'M4B ', 'M4P ']);
const MARCAS_VIDEO = new Set([
  'isom',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'dash',
  'M4V ',
  'MSNV',
]);

/** Detecta el formato por la firma. null si no es uno de los permitidos. */
export function detectarFormato(b: Buffer): FormatoDetectado | null {
  if (empiezaCon(b, [0xff, 0xd8, 0xff]))
    return { tipo: 'imagen', mime: 'image/jpeg', extension: 'jpg' };
  if (empiezaCon(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { tipo: 'imagen', mime: 'image/png', extension: 'png' };
  }
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    return { tipo: 'imagen', mime: 'image/webp', extension: 'webp' };
  }
  if (ascii(b, 4, 4) === 'ftyp') {
    const marca = ascii(b, 8, 4);
    if (MARCAS_AUDIO.has(marca))
      return { tipo: 'audio', mime: 'audio/mp4', extension: 'm4a' };
    if (MARCAS_VIDEO.has(marca))
      return { tipo: 'video', mime: 'video/mp4', extension: 'mp4' };
    return null;
  }
  if (ascii(b, 0, 3) === 'ID3')
    return { tipo: 'audio', mime: 'audio/mpeg', extension: 'mp3' };
  if (b.length >= 2 && b[0] === 0xff) {
    // ADTS (AAC): 1111 1111 1111 x00x — la capa siempre es 00.
    if ((b[1] & 0xf6) === 0xf0)
      return { tipo: 'audio', mime: 'audio/aac', extension: 'aac' };
    // Cuadro MPEG de audio (MP3 sin ID3): 1111 1111 111x xxxx con capa ≠ 00.
    if ((b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) {
      return { tipo: 'audio', mime: 'audio/mpeg', extension: 'mp3' };
    }
  }
  return null;
}
