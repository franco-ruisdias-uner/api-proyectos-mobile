import {
  claveDeUrl,
  detectarFormato,
  leerRango,
  urlDeArchivo,
} from './reglas.js';

const b = (...bytes: number[]) =>
  Buffer.from([...bytes, ...Array.from({ length: 16 }, () => 0)]);
const texto = (s: string, relleno = 16) =>
  Buffer.concat([Buffer.from(s, 'latin1'), Buffer.alloc(relleno)]);

describe('AGENTS §8 — Se chequea la firma del archivo, no la extensión', () => {
  it.each([
    ['jpeg', b(0xff, 0xd8, 0xff, 0xe0), 'imagen', 'jpg'],
    ['png', b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'imagen', 'png'],
    ['webp', texto('RIFF\x00\x00\x00\x00WEBPVP8 '), 'imagen', 'webp'],
    ['m4a', texto('\x00\x00\x00\x20ftypM4A '), 'audio', 'm4a'],
    ['mp4', texto('\x00\x00\x00\x20ftypisom'), 'video', 'mp4'],
    ['mp3 con ID3', texto('ID3\x04'), 'audio', 'mp3'],
    ['mp3 sin ID3', b(0xff, 0xfb, 0x90), 'audio', 'mp3'],
    ['aac ADTS', b(0xff, 0xf1, 0x50), 'audio', 'aac'],
  ])('%s', (_nombre, contenido, tipo, extension) => {
    expect(detectarFormato(contenido)).toMatchObject({ tipo, extension });
  });

  it.each([
    ['texto', Buffer.from('hola, esto es un txt')],
    ['pdf', Buffer.from('%PDF-1.7')],
    ['gif', Buffer.from('GIF89a')],
    ['vacío', Buffer.alloc(0)],
  ])('%s no se acepta', (_nombre, contenido) => {
    expect(detectarFormato(contenido)).toBeNull();
  });
});

describe('AGENTS §17.1 — Rangos (Range) para audio y video', () => {
  it.each([
    ['bytes=10-19', 100, { inicio: 10, fin: 19 }],
    ['bytes=10-', 100, { inicio: 10, fin: 99 }],
    ['bytes=-1', 100, { inicio: 99, fin: 99 }],
    ['bytes=-500', 100, { inicio: 0, fin: 99 }],
    ['bytes=90-200', 100, { inicio: 90, fin: 99 }],
    ['bytes=99-99', 100, { inicio: 99, fin: 99 }],
  ])('%s de %i bytes', (cabecera, total, esperado) => {
    expect(leerRango(cabecera, total)).toEqual(esperado);
  });

  it.each([['bytes=100-'], ['bytes=20-10'], ['bytes=-0']])(
    '%s no se puede satisfacer',
    (cabecera) => {
      expect(leerRango(cabecera, 100)).toBeNull();
    },
  );

  it.each([[undefined], ['items=1-2'], ['bytes=1-2,5-6'], ['bytes=-']])(
    '%o se ignora (va entero)',
    (cabecera) => {
      expect(leerRango(cabecera, 100)).toBeUndefined();
    },
  );
});

describe('AGENTS §8 — URLs de archivos', () => {
  it('arma la URL con el origen del pedido', () => {
    expect(
      urlDeArchivo('http://10.0.0.5:3000', 'imagenes/2026/09/abc12345.jpg'),
    ).toBe('http://10.0.0.5:3000/archivos/imagenes/2026/09/abc12345.jpg');
  });

  it.each([
    [
      'http://192.168.0.10:3000/archivos/imagenes/2026/09/abc12345.jpg',
      'imagenes/2026/09/abc12345.jpg',
    ],
    [
      'https://api.ejemplo.com/archivos/audios/2026/09/abc12345.m4a',
      'audios/2026/09/abc12345.m4a',
    ],
    ['file:///data/user/0/foto.jpg', null],
    ['http://otro.com/fotos/x.jpg', null],
    ['no es una url', null],
  ])('claveDeUrl(%o) = %o', (url, clave) => {
    expect(claveDeUrl(url)).toBe(clave);
  });
});
