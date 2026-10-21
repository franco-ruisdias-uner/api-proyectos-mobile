import { claveDeUrl, urlDeArchivo } from './urls.js';
import { esClaveValida, nuevaClave } from './keys.js';
import { conOrigen } from '../context/request-context.js';

describe('AGENTS §17.1 — Claves generadas por el servidor', () => {
  it('arma carpeta por tipo, año y mes', () => {
    const clave = nuevaClave(
      { tipo: 'audio', mime: 'audio/mp4', extension: 'm4a' },
      new Date('2026-09-28T12:00:00Z'),
    );
    expect(clave).toMatch(/^audios\/2026\/09\/[a-z0-9]{12}\.m4a$/);
    expect(esClaveValida(clave)).toBe(true);
  });

  it.each([
    '../etc/passwd',
    'imagenes/2026/09/../../x.jpg',
    'imagenes/2026/09/foto.exe',
    'otros/2026/09/abc123.jpg',
    'imagenes/2026/09/ABC.jpg',
    '',
  ])('rechaza %s', (clave) => {
    expect(esClaveValida(clave)).toBe(false);
  });
});

describe('AGENTS §8 — URLs absolutas con el origen del pedido', () => {
  it('arma la URL con el origen actual', () => {
    expect(conOrigen('http://10.0.0.5:3000', () => urlDeArchivo('imagenes/2026/09/abc123.jpg'))).toBe(
      'http://10.0.0.5:3000/archivos/imagenes/2026/09/abc123.jpg',
    );
  });

  it.each([
    ['http://10.0.0.5:3000/archivos/imagenes/2026/09/abc123.jpg', 'imagenes/2026/09/abc123.jpg'],
    ['https://api.ejemplo.com/archivos/audios/2026/01/xyz999.m4a', 'audios/2026/01/xyz999.m4a'],
    ['file:///data/visitas/vis-311.jpg', null],
    ['https://otro.com/fotos/abc.jpg', null],
    ['http://10.0.0.5:3000/archivos/../secreto.jpg', null],
    ['no es una url', null],
    ['ftp://10.0.0.5/archivos/imagenes/2026/09/abc123.jpg', null],
  ])('claveDeUrl(%s) = %s', (url, clave) => {
    expect(claveDeUrl(url)).toBe(clave);
  });
});
