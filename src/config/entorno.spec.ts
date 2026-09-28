import { validarEntorno } from './entorno.js';

const base = { JWT_SECRETO: 'secreto-de-prueba-bastante-largo' };

describe('AGENTS §11.3 — Configuración validada al arrancar', () => {
  it('defaults de desarrollo con SQLite', () => {
    const e = validarEntorno(base);
    expect(e.DB_MOTOR).toBe('better-sqlite3');
    expect(e.DB_ARCHIVO).toBe('datos/api.sqlite');
    expect(e.PUERTO).toBe(3000);
    expect(e.DB_SINCRONIZAR).toBe(true);
    expect(e.SIMULACION_HABILITADA).toBe(true);
    expect(e.ARCHIVOS_PROVEEDOR).toBe('local');
    expect(e.RELOJ_FIJO).toBeNull();
  });

  it('usa PORT si no hay PUERTO (Render, Koyeb)', () => {
    expect(validarEntorno({ ...base, PORT: '8080' }).PUERTO).toBe(8080);
    expect(validarEntorno({ ...base, PORT: '8080', PUERTO: '3001' }).PUERTO).toBe(3001);
  });

  it('sin JWT_SECRETO no arranca y lo dice en castellano', () => {
    expect(() => validarEntorno({})).toThrow(/JWT_SECRETO/);
  });

  it('motor desconocido', () => {
    expect(() => validarEntorno({ ...base, DB_MOTOR: 'oracle' })).toThrow(/DB_MOTOR/);
  });

  it('postgres, mysql y mariadb piden DB_URL', () => {
    for (const motor of ['postgres', 'mysql', 'mariadb']) {
      expect(() => validarEntorno({ ...base, DB_MOTOR: motor })).toThrow(/DB_URL/);
    }
    expect(validarEntorno({ ...base, DB_MOTOR: 'postgres', DB_URL: 'postgres://a:b@h:5432/d' }).DB_URL).toBe(
      'postgres://a:b@h:5432/d',
    );
  });

  it('RELOJ_FIJO tiene que ser un instante ISO', () => {
    expect(() => validarEntorno({ ...base, RELOJ_FIJO: 'ayer' })).toThrow(/RELOJ_FIJO/);
    expect(
      validarEntorno({ ...base, RELOJ_FIJO: '2026-11-14T21:00:00-03:00' }).RELOJ_FIJO?.toISOString(),
    ).toBe('2026-11-15T00:00:00.000Z');
  });

  it('booleanos: true/false', () => {
    expect(validarEntorno({ ...base, SIMULACION_HABILITADA: 'false' }).SIMULACION_HABILITADA).toBe(false);
    expect(() => validarEntorno({ ...base, DB_SINCRONIZAR: 'quizas' })).toThrow(/DB_SINCRONIZAR/);
  });

  it('URL_PUBLICA tiene que ser una URL http(s)', () => {
    expect(() => validarEntorno({ ...base, URL_PUBLICA: 'no-es-url' })).toThrow(/URL_PUBLICA/);
    expect(validarEntorno({ ...base, URL_PUBLICA: 'https://api.ejemplo.com/' }).URL_PUBLICA).toBe(
      'https://api.ejemplo.com',
    );
    expect(validarEntorno({ ...base, URL_PUBLICA: '' }).URL_PUBLICA).toBeNull();
  });

  it('NOTIFICACIONES: expo o registro', () => {
    expect(validarEntorno(base).NOTIFICACIONES).toBe('expo');
    expect(() => validarEntorno({ ...base, NOTIFICACIONES: 'sms' })).toThrow(/NOTIFICACIONES/);
  });

  it('en M0 sólo hay almacenamiento local', () => {
    expect(() => validarEntorno({ ...base, ARCHIVOS_PROVEEDOR: 'ftp' })).toThrow(/ARCHIVOS_PROVEEDOR/);
  });
});
