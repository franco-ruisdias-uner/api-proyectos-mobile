import { detectarTipoArchivo, LIMITES_BYTES } from './signatures.js';

const b = (...bytes: number[]) => Buffer.from(bytes);
const conRelleno = (inicio: Buffer, largo = 64) =>
  Buffer.concat([inicio, Buffer.alloc(Math.max(0, largo - inicio.length))]);
const ftyp = (marca: string) =>
  conRelleno(Buffer.concat([b(0, 0, 0, 0x20), Buffer.from('ftyp' + marca, 'latin1')]));

describe('AGENTS §8 — Se chequea la firma del archivo, no la extensión', () => {
  it.each([
    ['jpeg', conRelleno(b(0xff, 0xd8, 0xff, 0xe0)), 'imagen', 'image/jpeg', 'jpg'],
    ['png', conRelleno(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'imagen', 'image/png', 'png'],
    [
      'webp',
      conRelleno(Buffer.concat([Buffer.from('RIFF'), b(0, 0, 0, 0), Buffer.from('WEBP')])),
      'imagen',
      'image/webp',
      'webp',
    ],
    ['m4a', ftyp('M4A '), 'audio', 'audio/mp4', 'm4a'],
    ['aac', conRelleno(b(0xff, 0xf1, 0x50, 0x80)), 'audio', 'audio/aac', 'aac'],
    ['mp3 con ID3', conRelleno(Buffer.from('ID3')), 'audio', 'audio/mpeg', 'mp3'],
    ['mp3 sin ID3', conRelleno(b(0xff, 0xfb, 0x90, 0x00)), 'audio', 'audio/mpeg', 'mp3'],
    ['mp4 isom', ftyp('isom'), 'video', 'video/mp4', 'mp4'],
    ['mp4 mp42', ftyp('mp42'), 'video', 'video/mp4', 'mp4'],
  ])('%s', (_n, contenido, tipo, mime, ext) => {
    expect(detectarTipoArchivo(contenido)).toEqual({ tipo, mime, extension: ext });
  });

  it.each([
    ['texto', Buffer.from('hola, esto es un texto cualquiera')],
    ['pdf', conRelleno(Buffer.from('%PDF-1.7'))],
    ['gif', conRelleno(Buffer.from('GIF89a'))],
    ['vacío', Buffer.alloc(0)],
    ['quicktime', ftyp('qt  ')],
  ])('rechaza %s', (_n, contenido) => {
    expect(detectarTipoArchivo(contenido)).toBeNull();
  });

  it('límites: imagen 5 MB, audio 10 MB, video 30 MB', () => {
    expect(LIMITES_BYTES).toEqual({
      imagen: 5 * 1024 * 1024,
      audio: 10 * 1024 * 1024,
      video: 30 * 1024 * 1024,
    });
  });
});
