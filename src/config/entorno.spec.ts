import { validarEntorno } from './entorno.js';

const minimo = { JWT_SECRETO: 'un-secreto-de-prueba' };

describe('AGENTS §11.3 — El entorno se valida al arrancar', () => {
  it('con lo mínimo arranca con SQLite y los defaults de desarrollo', () => {
    const e = validarEntorno(minimo);
    expect(e).toMatchObject({
      puerto: 3000,
      entorno: 'desarrollo',
      dbMotor: 'better-sqlite3',
      dbArchivo: 'datos/api.sqlite',
      dbSincronizar: true,
      archivosProveedor: 'local',
      directorioArchivos: './archivos',
      notificaciones: 'expo',
      simulacionHabilitada: true,
      sembrarSiVacia: false,
      confiarProxy: false,
      urlPublica: null,
      relojFijo: null,
    });
  });

  it('PUERTO gana sobre PORT, y PORT sirve si no hay PUERTO', () => {
    expect(validarEntorno({ ...minimo, PORT: '8080' }).puerto).toBe(8080);
    expect(validarEntorno({ ...minimo, PORT: '8080', PUERTO: '4000' }).puerto).toBe(4000);
  });

  it('en test la simulación de fallas viene apagada', () => {
    expect(validarEntorno({ ...minimo, ENTORNO: 'test' }).simulacionHabilitada).toBe(false);
  });

  it('RELOJ_FIJO se interpreta como instante', () => {
    expect(
      validarEntorno({
        ...minimo,
        RELOJ_FIJO: '2026-11-14T21:00:00-03:00',
      }).relojFijo?.toISOString(),
    ).toBe('2026-11-15T00:00:00.000Z');
  });

  it.each([
    [{}, /JWT_SECRETO/],
    [{ ...minimo, DB_MOTOR: 'sqlite' }, /DB_MOTOR.*better-sqlite3/],
    [{ ...minimo, DB_MOTOR: 'postgres' }, /DB_URL/],
    [{ ...minimo, DB_MOTOR: 'mysql', DB_URL: 'no es url' }, /DB_URL/],
    [{ ...minimo, PUERTO: 'tres mil' }, /PUERTO/],
    [{ ...minimo, DB_SINCRONIZAR: 'quizas' }, /DB_SINCRONIZAR/],
    [{ ...minimo, RELOJ_FIJO: '2026-11-14 21:00' }, /RELOJ_FIJO/],
    [{ ...minimo, NOTIFICACIONES: 'paloma' }, /NOTIFICACIONES/],
    [{ ...minimo, URL_PUBLICA: 'mi-compu' }, /URL_PUBLICA/],
    [{ ...minimo, ARCHIVOS_PROVEEDOR: 'ftp' }, /ARCHIVOS_PROVEEDOR/],
  ])('%j no arranca y explica qué falta', (env, mensaje) => {
    expect(() => validarEntorno(env)).toThrow(mensaje);
  });

  it('junta todos los problemas en un solo mensaje', () => {
    expect(() => validarEntorno({ PUERTO: 'x' })).toThrow(/PUERTO[\s\S]*JWT_SECRETO/);
  });
});
