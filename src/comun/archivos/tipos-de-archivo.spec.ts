import { detectarFormato } from './tipos-de-archivo.js';

const bytes = (...partes: (number[] | string)[]): Buffer =>
  Buffer.concat(
    partes.map((p) =>
      typeof p === 'string' ? Buffer.from(p, 'latin1') : Buffer.from(p),
    ),
  );

const ftyp = (marca: string) =>
  bytes([0, 0, 0, 0x20], 'ftyp', marca, [0, 0, 0, 0]);

describe('AGENTS §8 — Se mira la firma del archivo, no la extensión', () => {
  it.each([
    [
      'jpeg',
      bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]),
      'imagen',
      'image/jpeg',
      'jpg',
    ],
    [
      'png',
      bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
      'imagen',
      'image/png',
      'png',
    ],
    [
      'webp',
      bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 '),
      'imagen',
      'image/webp',
      'webp',
    ],
    ['m4a', ftyp('M4A '), 'audio', 'audio/mp4', 'm4a'],
    ['mp3 con ID3', bytes('ID3', [4, 0, 0]), 'audio', 'audio/mpeg', 'mp3'],
    [
      'mp3 sin ID3',
      bytes([0xff, 0xfb, 0x90, 0x64]),
      'audio',
      'audio/mpeg',
      'mp3',
    ],
    [
      'aac (ADTS)',
      bytes([0xff, 0xf1, 0x50, 0x80]),
      'audio',
      'audio/aac',
      'aac',
    ],
    ['mp4 isom', ftyp('isom'), 'video', 'video/mp4', 'mp4'],
    ['mp4 mp42', ftyp('mp42'), 'video', 'video/mp4', 'mp4'],
  ])('%s', (_nombre, contenido, tipo, mime, extension) => {
    expect(detectarFormato(contenido)).toEqual({ tipo, mime, extension });
  });

  it.each([
    ['texto', bytes('hola, esto no es una foto')],
    ['pdf', bytes('%PDF-1.7')],
    ['gif', bytes('GIF89a')],
    ['quicktime', ftyp('qt  ')],
    ['vacío', Buffer.alloc(0)],
    ['un byte', bytes([0xff])],
  ])('rechaza %s', (_nombre, contenido) => {
    expect(detectarFormato(contenido)).toBeNull();
  });
});
