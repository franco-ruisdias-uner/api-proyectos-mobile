import { leerEntorno } from './entorno.js';

const minimo = { JWT_SECRETO: 'x'.repeat(40) };

describe('AGENTS §11.3 — La configuración se valida al arrancar', () => {
  it('con lo mínimo arranca con SQLite, puerto 3000 y archivos locales', () => {
    const e = leerEntorno(minimo);
    expect(e).toMatchObject({
      PUERTO: 3000,
      DB_MOTOR: 'better-sqlite3',
      DB_ARCHIVO: 'datos/api.sqlite',
      ARCHIVOS_PROVEEDOR: 'local',
      NOTIFICACIONES: 'registro',
      SIMULACION_HABILITADA: true,
      DB_SINCRONIZAR: true,
    });
  });

  it('sin JWT_SECRETO no arranca y dice qué falta en castellano', () => {
    expect(() => leerEntorno({})).toThrow(/Falta JWT_SECRETO/);
  });

  it('PORT sirve si no está PUERTO (lo inyectan los hosts)', () => {
    expect(leerEntorno({ ...minimo, PORT: '8080' }).PUERTO).toBe(8080);
    expect(
      leerEntorno({ ...minimo, PORT: '8080', PUERTO: '3001' }).PUERTO,
    ).toBe(3001);
  });

  it.each([
    [{ DB_MOTOR: 'sqlite' }, /DB_MOTOR tiene que ser/],
    [{ DB_MOTOR: 'postgres' }, /Falta DB_URL/],
    [
      { DB_MOTOR: 'mysql', DB_URL: 'no es url' },
      /DB_URL no es una dirección válida/,
    ],
    [{ PUERTO: 'abc' }, /PUERTO tiene que ser/],
    [{ DB_SINCRONIZAR: 'quizas' }, /DB_SINCRONIZAR tiene que ser/],
    [{ RELOJ_FIJO: '2026-09-15T08:00:00' }, /RELOJ_FIJO/],
    [{ URL_PUBLICA: 'http://x.com/api' }, /URL_PUBLICA/],
    [{ ARCHIVOS_PROVEEDOR: 'firebase' }, /ARCHIVOS_PROVEEDOR/],
    [{ NOTIFICACIONES: 'sms' }, /NOTIFICACIONES/],
    [{ ENTORNO: 'produccion' }, /ENTORNO tiene que ser/],
  ])('%o no arranca', (extra, mensaje) => {
    expect(() => leerEntorno({ ...minimo, ...extra })).toThrow(mensaje);
  });

  it('acepta los cuatro motores', () => {
    expect(
      leerEntorno({
        ...minimo,
        DB_MOTOR: 'mariadb',
        DB_URL: 'mysql://a:b@h:3306/api',
      }).DB_MOTOR,
    ).toBe('mariadb');
    expect(
      leerEntorno({
        ...minimo,
        DB_MOTOR: 'postgres',
        DB_URL: 'postgres://a:b@h/api',
      }).DB_URL,
    ).toBe('postgres://a:b@h/api');
  });

  it('la simulación de fallas está apagada por defecto fuera de desarrollo', () => {
    expect(
      leerEntorno({ ...minimo, ENTORNO: 'test' }).SIMULACION_HABILITADA,
    ).toBe(false);
  });

  it('URL_PUBLICA se guarda sin la barra final', () => {
    expect(
      leerEntorno({ ...minimo, URL_PUBLICA: 'https://api.ejemplo.com/' })
        .URL_PUBLICA,
    ).toBe('https://api.ejemplo.com');
  });
});
