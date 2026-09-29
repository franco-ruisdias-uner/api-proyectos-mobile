import { validarEntorno } from './entorno.js';

const minimo = { JWT_SECRETO: 'un-secreto-de-prueba-bastante-largo' };

describe('AGENTS §11.3 — El entorno se valida al arrancar', () => {
  it('con lo mínimo arranca con SQLite y los defaults de desarrollo', () => {
    const e = validarEntorno(minimo);
    expect(e).toMatchObject({
      PUERTO: 3000,
      ENTORNO: 'desarrollo',
      CONFIAR_PROXY: false,
      URL_PUBLICA: null,
      DB_MOTOR: 'better-sqlite3',
      DB_ARCHIVO: 'datos/api.sqlite',
      DB_URL: null,
      DB_SINCRONIZAR: true,
      ARCHIVOS_PROVEEDOR: 'local',
      DIRECTORIO_ARCHIVOS: './archivos',
      NOTIFICACIONES: 'expo',
      RELOJ_FIJO: null,
      SIMULACION_HABILITADA: true,
      SEMBRAR_SI_VACIA: false,
    });
  });

  it('PUERTO manda sobre PORT, y PORT sirve si no hay PUERTO (Render, Koyeb)', () => {
    expect(validarEntorno({ ...minimo, PORT: '8080' }).PUERTO).toBe(8080);
    expect(
      validarEntorno({ ...minimo, PORT: '8080', PUERTO: '4000' }).PUERTO,
    ).toBe(4000);
  });

  it.each([
    ['true', true],
    ['false', false],
    ['1', true],
    ['0', false],
    ['si', true],
    ['no', false],
  ])('booleano %s', (texto, valor) => {
    expect(
      validarEntorno({ ...minimo, CONFIAR_PROXY: texto }).CONFIAR_PROXY,
    ).toBe(valor);
  });

  it('RELOJ_FIJO se lee como instante', () => {
    expect(
      validarEntorno({
        ...minimo,
        RELOJ_FIJO: '2026-09-14T10:00:00-03:00',
      }).RELOJ_FIJO?.toISOString(),
    ).toBe('2026-09-14T13:00:00.000Z');
  });

  it('URL_PUBLICA sin barra final', () => {
    expect(
      validarEntorno({ ...minimo, URL_PUBLICA: 'https://api.ejemplo.com/' })
        .URL_PUBLICA,
    ).toBe('https://api.ejemplo.com');
  });

  it('un motor de red necesita DB_URL', () => {
    expect(
      validarEntorno({
        ...minimo,
        DB_MOTOR: 'postgres',
        DB_URL: 'postgres://a:b@h:5432/d',
      }).DB_URL,
    ).toBe('postgres://a:b@h:5432/d');
  });

  it.each([
    ['falta JWT_SECRETO', {}, /JWT_SECRETO/],
    [
      'motor desconocido',
      { ...minimo, DB_MOTOR: 'sqlite' },
      /DB_MOTOR.*better-sqlite3/s,
    ],
    ['postgres sin DB_URL', { ...minimo, DB_MOTOR: 'postgres' }, /DB_URL/],
    ['puerto inválido', { ...minimo, PUERTO: 'abc' }, /PUERTO/],
    [
      'booleano inválido',
      { ...minimo, DB_SINCRONIZAR: 'quizas' },
      /DB_SINCRONIZAR/,
    ],
    [
      'RELOJ_FIJO sin offset',
      { ...minimo, RELOJ_FIJO: '2026-09-14T10:00:00' },
      /RELOJ_FIJO/,
    ],
    [
      'NOTIFICACIONES desconocido',
      { ...minimo, NOTIFICACIONES: 'mail' },
      /NOTIFICACIONES/,
    ],
    [
      'URL_PUBLICA no es URL',
      { ...minimo, URL_PUBLICA: 'mi-compu' },
      /URL_PUBLICA/,
    ],
    ['ENTORNO desconocido', { ...minimo, ENTORNO: 'prod' }, /ENTORNO/],
    [
      'proveedor de archivos desconocido',
      { ...minimo, ARCHIVOS_PROVEEDOR: 'dropbox' },
      /ARCHIVOS_PROVEEDOR/,
    ],
  ])('%s → no arranca y lo dice en castellano', (_caso, crudo, patron) => {
    expect(() => validarEntorno(crudo)).toThrow(patron);
  });

  it('junta todos los problemas en un solo mensaje', () => {
    expect(() => validarEntorno({ DB_MOTOR: 'postgres' })).toThrow(
      /JWT_SECRETO[\s\S]*DB_URL/,
    );
  });
});
