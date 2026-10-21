export type TipoArchivo = 'imagen' | 'audio' | 'video';

export interface FormatoArchivo {
  tipo: TipoArchivo;
  mime: string;
  ext: string;
  maxBytes: number;
}

const MB = 1024 * 1024;
export const LIMITES: Record<TipoArchivo, number> = {
  imagen: 5 * MB,
  audio: 10 * MB,
  video: 30 * MB,
};
export const MAX_BYTES_SUBIDA = LIMITES.video;

const formato = (tipo: TipoArchivo, mime: string, ext: string): FormatoArchivo => ({
  tipo,
  mime,
  ext,
  maxBytes: LIMITES[tipo],
});

const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};

export function mimeDeExtension(ext: string): string {
  return MIME_POR_EXTENSION[ext] ?? 'application/octet-stream';
}

const texto = (b: Buffer, desde: number, hasta: number) =>
  b.subarray(desde, hasta).toString('latin1');

/** Reconoce el formato por los primeros bytes (la firma), no por el nombre. */
export function detectarTipoArchivo(b: Buffer): FormatoArchivo | null {
  if (b.length < 4) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return formato('imagen', 'image/jpeg', 'jpg');
  if (b[0] === 0x89 && texto(b, 1, 4) === 'PNG') return formato('imagen', 'image/png', 'png');
  if (texto(b, 0, 4) === 'RIFF' && texto(b, 8, 12) === 'WEBP')
    return formato('imagen', 'image/webp', 'webp');
  if (texto(b, 4, 8) === 'ftyp') {
    const marca = texto(b, 8, 12);
    if (marca === 'M4A ' || marca === 'M4B ') return formato('audio', 'audio/mp4', 'm4a');
    return formato('video', 'video/mp4', 'mp4');
  }
  if (texto(b, 0, 3) === 'ID3') return formato('audio', 'audio/mpeg', 'mp3');
  if (b[0] === 0xff) {
    // ADTS (AAC): 1111 1111 1111 x00x — capa 00.
    if ((b[1] & 0xf6) === 0xf0) return formato('audio', 'audio/aac', 'aac');
    // Trama MPEG audio capa III: 1111 1111 111x x01x.
    if ((b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) === 0x02)
      return formato('audio', 'audio/mpeg', 'mp3');
  }
  return null;
}
