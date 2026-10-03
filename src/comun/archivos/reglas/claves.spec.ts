import { claveDesdeUrl, esClaveValida, nuevaClave } from './claves.js';

describe('AGENTS §17.1 — Claves de archivo generadas por el servidor', () => {
  it('arma <carpeta>/<AAAA>/<MM>/<id>.<ext> con el mes de Buenos Aires', () => {
    // 1/11 a las 01:00 UTC es todavía 31/10 en Buenos Aires.
    const clave = nuevaClave('imagen', 'jpg', new Date('2026-11-01T01:00:00Z'));
    expect(clave).toMatch(/^imagenes\/2026\/10\/[a-z0-9]{16}\.jpg$/);
    expect(esClaveValida(clave)).toBe(true);
  });

  it.each([
    ['audios/2026/01/abcdefghijklmnop.m4a', true],
    ['videos/2026/12/abcdefghijklmnop.mp4', true],
    ['imagenes/2026/10/../../etc/passwd', false],
    ['../secreto.jpg', false],
    ['otros/2026/10/abcdefghijklmnop.jpg', false],
    ['imagenes/2026/10/abc.exe', false],
    ['', false],
  ])('esClaveValida(%s) = %s', (clave, esperado) => {
    expect(esClaveValida(clave)).toBe(esperado);
  });
});

describe('AGENTS §8 — Una URL que no es de /archivos de esta API se rechaza', () => {
  it.each([
    [
      'http://192.168.0.10:3000/archivos/imagenes/2026/10/abcdefghijklmnop.jpg',
      'imagenes/2026/10/abcdefghijklmnop.jpg',
    ],
    [
      'https://api.ejemplo.com/archivos/videos/2026/01/abcdefghijklmnop.mp4',
      'videos/2026/01/abcdefghijklmnop.mp4',
    ],
    ['file:///storage/emulated/0/foto.jpg', null],
    ['https://otro.com/foto.jpg', null],
    ['http://192.168.0.10:3000/archivos/../datos/api.sqlite', null],
    ['no es una url', null],
    ['', null],
  ])('%s → %s', (url, esperado) => {
    expect(claveDesdeUrl(url)).toBe(esperado);
  });
});
