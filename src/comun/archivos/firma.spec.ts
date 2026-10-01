import { detectarTipoDeArchivo } from './firma.js';

const conRelleno = (inicio: number[], largo = 64) => {
  const b = Buffer.alloc(largo);
  Buffer.from(inicio).copy(b);
  return b;
};
const ftyp = (marca: string) => {
  const b = Buffer.alloc(64);
  b.writeUInt32BE(24, 0);
  b.write('ftyp', 4, 'latin1');
  b.write(marca, 8, 'latin1');
  return b;
};
const riff = (formato: string) => {
  const b = Buffer.alloc(64);
  b.write('RIFF', 0, 'latin1');
  b.write(formato, 8, 'latin1');
  return b;
};

describe('AGENTS §8 — se chequea la firma del archivo, no la extensión', () => {
  it.each([
    ['jpeg', conRelleno([0xff, 0xd8, 0xff, 0xe0]), 'imagen', 'image/jpeg', 'jpg'],
    ['png', conRelleno([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'imagen', 'image/png', 'png'],
    ['webp', riff('WEBP'), 'imagen', 'image/webp', 'webp'],
    ['mp3 con ID3', conRelleno([0x49, 0x44, 0x33, 0x04]), 'audio', 'audio/mpeg', 'mp3'],
    ['mp3 sin ID3', conRelleno([0xff, 0xfb, 0x90, 0x00]), 'audio', 'audio/mpeg', 'mp3'],
    ['aac (ADTS)', conRelleno([0xff, 0xf1, 0x50, 0x80]), 'audio', 'audio/aac', 'aac'],
    ['m4a', ftyp('M4A '), 'audio', 'audio/mp4', 'm4a'],
    ['mp4 isom', ftyp('isom'), 'video', 'video/mp4', 'mp4'],
    ['mp4 mp42', ftyp('mp42'), 'video', 'video/mp4', 'mp4'],
  ])('%s', (_nombre, contenido, tipo, mime, extension) => {
    expect(detectarTipoDeArchivo(contenido)).toEqual({ tipo, mime, extension });
  });

  it.each([
    ['texto', Buffer.from('hola, esto no es una foto')],
    ['pdf', Buffer.from('%PDF-1.7 ...')],
    ['gif', Buffer.from('GIF89a......')],
    ['wav', riff('WAVE')],
    ['quicktime', ftyp('qt  ')],
    ['vacío', Buffer.alloc(0)],
    ['muy corto', Buffer.from([0xff, 0xd8])],
  ])('rechaza %s', (_nombre, contenido) => {
    expect(detectarTipoDeArchivo(contenido)).toBeNull();
  });
});
