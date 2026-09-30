import { detectarTipoArchivo } from './tipos-archivo.js';

const bytes = (...partes: (number[] | string | Buffer)[]): Buffer =>
  Buffer.concat(
    partes.map((p) =>
      typeof p === 'string'
        ? Buffer.from(p, 'latin1')
        : Buffer.isBuffer(p)
          ? p
          : Buffer.from(p),
    ),
  );
const relleno = Buffer.alloc(64);
const ftyp = (marca: string) =>
  bytes([0, 0, 0, 0x20], 'ftyp', marca, [0, 0, 0, 0], relleno);

describe('AGENTS §8 — Tipos de archivo por firma, no por extensión', () => {
  it.each([
    [
      'jpeg',
      bytes([0xff, 0xd8, 0xff, 0xe0], relleno),
      'image/jpeg',
      'imagen',
      'jpg',
      'image/jpeg',
    ],
    [
      'png',
      bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], relleno),
      'image/png',
      'imagen',
      'png',
      'image/png',
    ],
    [
      'webp',
      bytes('RIFF', [0, 0, 0, 0], 'WEBP', relleno),
      'image/webp',
      'imagen',
      'webp',
      'image/webp',
    ],
    [
      'mp3 con ID3',
      bytes('ID3', relleno),
      'audio/mpeg',
      'audio',
      'mp3',
      'audio/mpeg',
    ],
    [
      'mp3 sin ID3',
      bytes([0xff, 0xfb, 0x90, 0x00], relleno),
      'audio/mpeg',
      'audio',
      'mp3',
      'audio/mpeg',
    ],
    [
      'aac ADTS',
      bytes([0xff, 0xf1, 0x50, 0x80], relleno),
      'audio/aac',
      'audio',
      'aac',
      'audio/aac',
    ],
    ['m4a de iPhone', ftyp('M4A '), 'audio/x-m4a', 'audio', 'm4a', 'audio/mp4'],
    [
      'm4a de Android (marca mp42)',
      ftyp('mp42'),
      'audio/mp4',
      'audio',
      'm4a',
      'audio/mp4',
    ],
    ['mp4', ftyp('isom'), 'video/mp4', 'video', 'mp4', 'video/mp4'],
    [
      'mp4 sin tipo declarado',
      ftyp('mp42'),
      'application/octet-stream',
      'video',
      'mp4',
      'video/mp4',
    ],
  ])('%s', (_caso, contenido, declarado, tipo, extension, mime) => {
    expect(
      detectarTipoArchivo(contenido as Buffer, declarado as string, 'x'),
    ).toEqual({
      tipo,
      extension,
      mime,
    });
  });

  it('m4a reconocido por la extensión del nombre', () => {
    expect(
      detectarTipoArchivo(ftyp('isom'), 'application/octet-stream', 'nota.m4a')
        ?.tipo,
    ).toBe('audio');
  });

  it.each([
    ['pdf', bytes('%PDF-1.7', relleno)],
    ['texto con extensión .jpg', bytes('hola mundo', relleno)],
    ['gif', bytes('GIF89a', relleno)],
    ['vacío', Buffer.alloc(0)],
    ['RIFF que no es WEBP (wav)', bytes('RIFF', [0, 0, 0, 0], 'WAVE', relleno)],
  ])('rechaza %s', (_caso, contenido) => {
    expect(detectarTipoArchivo(contenido, 'image/jpeg', 'foto.jpg')).toBeNull();
  });
});
