import type { ArchivoSubido } from '../../../contract/api.js';

export type TipoDeArchivo = ArchivoSubido['tipo'];

export interface ArchivoDetectado {
  tipo: TipoDeArchivo;
  mime: string;
  extension: string;
}

const MARCAS_DE_AUDIO_MP4 = ['M4A ', 'M4B '];
const MARCAS_DE_VIDEO_MP4 = [
  'isom',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'M4V ',
  'MSNV',
  'dash',
];

/**
 * Detecta el tipo por los primeros bytes (la "firma"), no por la extensión ni por lo que
 * dice el cliente. Devuelve null si no es uno de los formatos permitidos (AGENTS §8).
 */
export function detectarTipoDeArchivo(contenido: Buffer): ArchivoDetectado | null {
  if (contenido.length < 12) return null;
  const empiezaCon = (...bytes: number[]) => bytes.every((b, i) => contenido[i] === b);
  const texto = (desde: number, hasta: number) => contenido.toString('latin1', desde, hasta);

  if (empiezaCon(0xff, 0xd8, 0xff)) return { tipo: 'imagen', mime: 'image/jpeg', extension: 'jpg' };
  if (empiezaCon(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { tipo: 'imagen', mime: 'image/png', extension: 'png' };
  }
  if (texto(0, 4) === 'RIFF' && texto(8, 12) === 'WEBP') {
    return { tipo: 'imagen', mime: 'image/webp', extension: 'webp' };
  }
  if (texto(4, 8) === 'ftyp') {
    const marca = texto(8, 12);
    if (MARCAS_DE_AUDIO_MP4.includes(marca))
      return { tipo: 'audio', mime: 'audio/mp4', extension: 'm4a' };
    if (MARCAS_DE_VIDEO_MP4.includes(marca))
      return { tipo: 'video', mime: 'video/mp4', extension: 'mp4' };
    return null;
  }
  if (texto(0, 3) === 'ID3') return { tipo: 'audio', mime: 'audio/mpeg', extension: 'mp3' };
  if (contenido[0] === 0xff) {
    // ADTS (AAC): 1111 1111 1111 x00x — capa 00
    if ((contenido[1] & 0xf6) === 0xf0)
      return { tipo: 'audio', mime: 'audio/aac', extension: 'aac' };
    // MPEG audio (MP3): sincronización de 11 bits y capa III
    if ((contenido[1] & 0xe0) === 0xe0 && (contenido[1] & 0x06) === 0x02) {
      return { tipo: 'audio', mime: 'audio/mpeg', extension: 'mp3' };
    }
  }
  return null;
}

/** Límites por tipo (AGENTS §8). */
export const LIMITE_DE_BYTES: Record<TipoDeArchivo, number> = {
  imagen: 5 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  video: 30 * 1024 * 1024,
};

export const LIMITE_MAXIMO_DE_BYTES = Math.max(...Object.values(LIMITE_DE_BYTES));

export const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
};
