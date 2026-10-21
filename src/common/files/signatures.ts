export type TipoArchivo = 'imagen' | 'audio' | 'video';

export interface ArchivoDetectado {
  tipo: TipoArchivo;
  mime: string;
  extension: string;
}

export const LIMITES_BYTES: Record<TipoArchivo, number> = {
  imagen: 5 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  video: 30 * 1024 * 1024,
};

/** El más grande de los límites: lo que acepta el receptor antes de mirar el tipo. */
export const LIMITE_MAXIMO_BYTES = Math.max(...Object.values(LIMITES_BYTES));

const MARCAS_AUDIO_MP4 = new Set(['M4A ', 'M4B ', 'M4P ']);
const MARCAS_VIDEO_MP4 = new Set([
  'isom',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'dash',
  'MSNV',
  'M4V ',
]);

const empiezaCon = (c: Buffer, firma: number[], desde = 0) =>
  c.length >= desde + firma.length && firma.every((byte, i) => c[desde + i] === byte);
const texto = (c: Buffer, desde: number, largo: number) =>
  c.subarray(desde, desde + largo).toString('latin1');

/** Detecta el tipo mirando los primeros bytes (la firma), no el nombre ni la extensión. */
export function detectarTipoArchivo(c: Buffer): ArchivoDetectado | null {
  if (empiezaCon(c, [0xff, 0xd8, 0xff])) return { tipo: 'imagen', mime: 'image/jpeg', extension: 'jpg' };
  if (empiezaCon(c, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { tipo: 'imagen', mime: 'image/png', extension: 'png' };
  if (texto(c, 0, 4) === 'RIFF' && texto(c, 8, 4) === 'WEBP')
    return { tipo: 'imagen', mime: 'image/webp', extension: 'webp' };
  if (texto(c, 4, 4) === 'ftyp') {
    const marca = texto(c, 8, 4);
    if (MARCAS_AUDIO_MP4.has(marca)) return { tipo: 'audio', mime: 'audio/mp4', extension: 'm4a' };
    if (MARCAS_VIDEO_MP4.has(marca)) return { tipo: 'video', mime: 'video/mp4', extension: 'mp4' };
    return null;
  }
  if (texto(c, 0, 3) === 'ID3') return { tipo: 'audio', mime: 'audio/mpeg', extension: 'mp3' };
  if (c.length >= 2 && c[0] === 0xff) {
    // ADTS (AAC): 1111 1111 1111 x00x
    if ((c[1] & 0xf6) === 0xf0) return { tipo: 'audio', mime: 'audio/aac', extension: 'aac' };
    // Cuadro MPEG de audio capa III (mp3 sin ID3)
    if ((c[1] & 0xe0) === 0xe0 && (c[1] & 0x06) === 0x02)
      return { tipo: 'audio', mime: 'audio/mpeg', extension: 'mp3' };
  }
  return null;
}
