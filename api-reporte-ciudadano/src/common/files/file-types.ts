// Tipos de archivo admitidos, reconocidos por su firma (AGENTS §8).

export type TipoArchivo = 'imagen' | 'audio' | 'video';
export type Extension = 'jpg' | 'png' | 'webp' | 'm4a' | 'aac' | 'mp3' | 'mp4';

export interface TipoDetectado {
  tipo: TipoArchivo;
  extension: Extension;
  mime: string;
}

const MB = 1024 * 1024;

export const LIMITE_POR_TIPO: Record<TipoArchivo, number> = {
  imagen: 5 * MB,
  audio: 10 * MB,
  video: 30 * MB,
};

/** El mayor de los límites: lo que se acepta recibir antes de mirar el tipo. */
export const LIMITE_MAXIMO = Math.max(...Object.values(LIMITE_POR_TIPO));

export const MIME_POR_EXTENSION: Record<Extension, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};

const CARPETA: Record<TipoArchivo, string> = {
  imagen: 'imagenes',
  audio: 'audios',
  video: 'videos',
};
export const carpetaDe = (tipo: TipoArchivo): string => CARPETA[tipo];

const detectado = (tipo: TipoArchivo, extension: Extension): TipoDetectado => ({
  tipo,
  extension,
  mime: MIME_POR_EXTENSION[extension],
});

const empiezaCon = (b: Buffer, firma: number[], desde = 0) =>
  b.length >= desde + firma.length &&
  firma.every((byte, i) => b[desde + i] === byte);
const texto = (b: Buffer, desde: number, largo: number) =>
  b.length >= desde + largo ? b.toString('latin1', desde, desde + largo) : '';

/**
 * Reconoce el archivo por sus primeros bytes. En los contenedores MP4 (ftyp), que usan tanto
 * el audio m4a como el video, decide por la marca y, si la marca es genérica (Android graba
 * m4a como `mp42`/`isom`), por el tipo o la extensión que declaró el teléfono.
 */
export function detectarTipoArchivo(
  contenido: Buffer,
  mimeDeclarado: string,
  nombreOriginal: string,
): TipoDetectado | null {
  if (empiezaCon(contenido, [0xff, 0xd8, 0xff]))
    return detectado('imagen', 'jpg');
  if (empiezaCon(contenido, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return detectado('imagen', 'png');
  if (texto(contenido, 0, 4) === 'RIFF' && texto(contenido, 8, 4) === 'WEBP')
    return detectado('imagen', 'webp');
  if (texto(contenido, 0, 3) === 'ID3') return detectado('audio', 'mp3');
  if (
    contenido.length >= 2 &&
    contenido[0] === 0xff &&
    (contenido[1] & 0xf6) === 0xf0
  ) {
    return detectado('audio', 'aac'); // ADTS: 1111 1111 1111 x00x
  }
  if (
    contenido.length >= 2 &&
    contenido[0] === 0xff &&
    (contenido[1] & 0xe0) === 0xe0
  ) {
    return detectado('audio', 'mp3'); // trama MPEG sin ID3
  }
  if (texto(contenido, 4, 4) === 'ftyp') {
    const marca = texto(contenido, 8, 4);
    if (marca.startsWith('M4A') || marca.startsWith('M4B'))
      return detectado('audio', 'm4a');
    const pareceAudio =
      mimeDeclarado.startsWith('audio/') ||
      /\.(m4a|aac|mp3)$/i.test(nombreOriginal);
    return pareceAudio ? detectado('audio', 'm4a') : detectado('video', 'mp4');
  }
  return null;
}
