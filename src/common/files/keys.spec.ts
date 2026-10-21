import { claveDeUrl, esClaveValida, nuevaClave } from './keys.js';

describe('AGENTS §17.1 — claves de archivos generadas por el servidor', () => {
  it('arma <carpeta>/<AAAA>/<MM>/<id>.<ext> con el mes de Buenos Aires', () => {
    // 2026-10-01 02:30 UTC todavía es 30/9 a las 23:30 en Buenos Aires
    const clave = nuevaClave('imagen', 'jpg', new Date('2026-10-01T02:30:00Z'));
    expect(clave).toMatch(/^imagenes\/2026\/09\/[a-z0-9]{24}\.jpg$/);
    expect(esClaveValida(clave)).toBe(true);
    expect(nuevaClave('audio', 'm4a', new Date('2026-12-31T12:00:00Z'))).toMatch(
      /^audios\/2026\/12\//,
    );
    expect(nuevaClave('video', 'mp4', new Date('2026-12-31T12:00:00Z'))).toMatch(/^videos\//);
  });

  it.each([
    ['imagenes/2026/09/abcdefghijklmnopqrstuvwx.jpg', true],
    ['videos/2026/12/abcdefghijklmnopqrstuvwx.mp4', true],
    ['../etc/passwd', false],
    ['imagenes/2026/09/../../x.jpg', false],
    ['imagenes/2026/09/ABC.jpg', false],
    ['otros/2026/09/abcdefghijklmnopqrstuvwx.jpg', false],
    ['imagenes/2026/09/abcdefghijklmnopqrstuvwx.exe', false],
    ['imagenes/26/9/abcdefghijklmnopqrstuvwx.jpg', false],
    ['', false],
  ])('esClaveValida(%j) = %s', (clave, esperado) => {
    expect(esClaveValida(clave)).toBe(esperado);
  });

  it.each([
    [
      'http://192.168.0.10:3000/archivos/imagenes/2026/09/abcdefghijklmnopqrstuvwx.jpg',
      'imagenes/2026/09/abcdefghijklmnopqrstuvwx.jpg',
    ],
    [
      'https://api.ejemplo.ar/archivos/videos/2026/09/abcdefghijklmnopqrstuvwx.mp4',
      'videos/2026/09/abcdefghijklmnopqrstuvwx.mp4',
    ],
    ['file:///data/archivos/imagenes/2026/09/abcdefghijklmnopqrstuvwx.jpg', null],
    ['https://otro.sitio/fotos/abc.jpg', null],
    ['https://api.ejemplo.ar/archivos/../secreto', null],
    ['no es una url', null],
  ])('AGENTS §8 — claveDeUrl(%j) = %j', (url, esperado) => {
    expect(claveDeUrl(url)).toBe(esperado);
  });
});
