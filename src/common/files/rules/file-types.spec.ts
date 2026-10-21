import { detectarTipoArchivo } from './file-types.js';

const con = (...bytes: (number | string)[]) =>
  Buffer.concat([
    ...bytes.map((b) => (typeof b === 'string' ? Buffer.from(b, 'latin1') : Buffer.from([b]))),
    Buffer.alloc(32),
  ]);

describe('AGENTS §8 — Se chequea la firma del archivo, no la extensión', () => {
  it.each([
    ['jpeg', con(0xff, 0xd8, 0xff, 0xe0), 'imagen', 'image/jpeg', 'jpg'],
    ['png', con(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a), 'imagen', 'image/png', 'png'],
    ['webp', con('RIFF', 0, 0, 0, 0, 'WEBP'), 'imagen', 'image/webp', 'webp'],
    ['mp4', con(0, 0, 0, 0x20, 'ftypisom'), 'video', 'video/mp4', 'mp4'],
    ['mp4 (mp42)', con(0, 0, 0, 0x18, 'ftypmp42'), 'video', 'video/mp4', 'mp4'],
    ['m4a', con(0, 0, 0, 0x20, 'ftypM4A '), 'audio', 'audio/mp4', 'm4a'],
    ['aac (ADTS)', con(0xff, 0xf1, 0x50, 0x80), 'audio', 'audio/aac', 'aac'],
    ['mp3 con ID3', con('ID3', 3, 0), 'audio', 'audio/mpeg', 'mp3'],
    ['mp3 sin ID3', con(0xff, 0xfb, 0x90, 0x64), 'audio', 'audio/mpeg', 'mp3'],
  ])('%s', (_nombre, contenido, tipo, mime, ext) => {
    expect(detectarTipoArchivo(contenido)).toMatchObject({ tipo, mime, ext });
  });

  it.each([
    ['texto', Buffer.from('hola, esto no es una foto')],
    ['pdf', con('%PDF-1.7')],
    ['gif', con('GIF89a')],
    ['vacío', Buffer.alloc(0)],
    ['un byte', Buffer.from([0xff])],
  ])('%s → no permitido', (_nombre, contenido) => {
    expect(detectarTipoArchivo(contenido)).toBeNull();
  });

  it('límites: imagen 5 MB, audio 10 MB, video 30 MB', () => {
    expect(detectarTipoArchivo(con(0xff, 0xd8, 0xff))?.maxBytes).toBe(5 * 1024 * 1024);
    expect(detectarTipoArchivo(con('ID3'))?.maxBytes).toBe(10 * 1024 * 1024);
    expect(detectarTipoArchivo(con(0, 0, 0, 0x20, 'ftypisom'))?.maxBytes).toBe(30 * 1024 * 1024);
  });
});
