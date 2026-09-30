import { claveDesdeUrl, esClaveValida, nuevaClave } from './claves.js';

describe('AGENTS §17.1 — Clave <imagenes|audios|videos>/<AAAA>/<MM>/<id>.<ext>', () => {
  it('se arma con el año y el mes de Buenos Aires', () => {
    // 1/10 a las 01:00 UTC es todavía 30/9 en Argentina
    const clave = nuevaClave('imagen', 'jpg', new Date('2026-10-01T01:00:00Z'));
    expect(clave).toMatch(/^imagenes\/2026\/09\/[a-z0-9]{24}\.jpg$/);
    expect(esClaveValida(clave)).toBe(true);
  });

  it.each([
    ['audios/2026/09/abcdefghabcdefghabcdefgh.m4a', true],
    ['videos/2026/12/abcdefghabcdefghabcdefgh.mp4', true],
    ['imagenes/2026/09/../../etc/passwd', false],
    ['otros/2026/09/abcdefghabcdefghabcdefgh.jpg', false],
    ['imagenes/2026/09/abcdefghabcdefghabcdefgh.exe', false],
    ['imagenes/2026/9/abcdefghabcdefghabcdefgh.jpg', false],
    ['', false],
  ])('esClaveValida(%s) = %s', (clave, esperado) => {
    expect(esClaveValida(clave)).toBe(esperado);
  });
});

describe('AGENTS §8 — Una URL que llega en un recurso tiene que ser de /archivos', () => {
  const clave = 'imagenes/2026/09/abcdefghabcdefghabcdefgh.jpg';

  it.each([
    [`http://192.168.0.10:3000/archivos/${clave}`],
    [`https://api.ejemplo.com/archivos/${clave}`],
    [`http://localhost:3000/archivos/${clave}?v=1`],
  ])('%s → clave', (url) => {
    expect(claveDesdeUrl(url)).toBe(clave);
  });

  it.each([
    ['file://', `file:///data/user/0/host.exp.exponent/cache/${clave}`],
    ['otra ruta', `http://192.168.0.10:3000/otra/${clave}`],
    ['clave inválida', 'http://192.168.0.10:3000/archivos/imagenes/x.jpg'],
    ['no es URL', 'foto.jpg'],
    ['content://', `content://media/archivos/${clave}`],
  ])('%s → null', (_caso, url) => {
    expect(claveDesdeUrl(url)).toBeNull();
  });
});
