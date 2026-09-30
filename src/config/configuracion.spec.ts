import { ErrorDeConfiguracion, leerConfiguracion } from './configuracion.js';

const minimo = { JWT_SECRETO: 'secreto-de-prueba' };

function problemasDe(env: Record<string, string>): string[] {
  try {
    leerConfiguracion(env);
  } catch (error) {
    if (error instanceof ErrorDeConfiguracion) return error.problemas;
    throw error;
  }
  return [];
}

describe('AGENTS §11.3 — la configuración se valida al arrancar', () => {
  it('con lo mínimo arranca con SQLite, disco local y valores de desarrollo', () => {
    const c = leerConfiguracion(minimo);
    expect(c.puerto).toBe(3000);
    expect(c.entorno).toBe('desarrollo');
    expect(c.db).toEqual({
      motor: 'better-sqlite3',
      url: null,
      archivo: 'datos/api.sqlite',
      sincronizar: true,
    });
    expect(c.archivos.proveedor).toBe('local');
    expect(c.simulacionHabilitada).toBe(true);
    expect(c.sembrarSiVacia).toBe(false);
    expect(c.relojFijo).toBeNull();
    expect(c.urlPublica).toBeNull();
  });

  it('sin JWT_SECRETO no arranca y lo dice en castellano', () => {
    const problemas = problemasDe({});
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/Falta JWT_SECRETO/);
  });

  it('el mensaje completo explica cómo arreglarlo', () => {
    expect(() => leerConfiguracion({})).toThrow(/Revisá el archivo \.env/);
  });

  it('usa PORT si no hay PUERTO (lo inyectan los hosts)', () => {
    expect(leerConfiguracion({ ...minimo, PORT: '10000' }).puerto).toBe(10000);
    expect(leerConfiguracion({ ...minimo, PORT: '10000', PUERTO: '4000' }).puerto).toBe(4000);
  });

  it.each([['0'], ['70000'], ['abc'], ['3000.5']])('rechaza PUERTO=%s', (valor) => {
    expect(problemasDe({ ...minimo, PUERTO: valor })[0]).toMatch(/PUERTO/);
  });

  it.each(['postgres', 'mysql', 'mariadb'])('con DB_MOTOR=%s exige DB_URL', (motor) => {
    expect(problemasDe({ ...minimo, DB_MOTOR: motor })[0]).toMatch(/Falta DB_URL/);
  });

  it('rechaza un motor desconocido', () => {
    expect(problemasDe({ ...minimo, DB_MOTOR: 'sqlite' })[0]).toMatch(
      /DB_MOTOR vale "sqlite".*better-sqlite3, postgres, mysql, mariadb/,
    );
  });

  it('rechaza una DB_URL de otro motor', () => {
    expect(
      problemasDe({ ...minimo, DB_MOTOR: 'postgres', DB_URL: 'mysql://a:b@h/api' })[0],
    ).toMatch(/tiene que empezar con "postgres:\/\/"/);
  });

  it('acepta una DB_URL con caracteres raros en la contraseña', () => {
    const c = leerConfiguracion({
      ...minimo,
      DB_MOTOR: 'mariadb',
      DB_URL: 'mysql://api:p%40ss%23word@localhost:3306/api',
    });
    expect(c.db.motor).toBe('mariadb');
  });

  it.each([['si'], ['1'], ['TRUE']])('los booleanos sólo aceptan true o false (%s)', (v) => {
    expect(problemasDe({ ...minimo, DB_SINCRONIZAR: v })[0]).toMatch(/DB_SINCRONIZAR/);
  });

  it('RELOJ_FIJO tiene que traer zona', () => {
    expect(problemasDe({ ...minimo, RELOJ_FIJO: '2026-11-14T22:00:00' })[0]).toMatch(/RELOJ_FIJO/);
    const c = leerConfiguracion({ ...minimo, RELOJ_FIJO: '2026-11-14T22:00:00-03:00' });
    expect(c.relojFijo?.toISOString()).toBe('2026-11-15T01:00:00.000Z');
  });

  it('la simulación viene apagada fuera de desarrollo', () => {
    expect(leerConfiguracion({ ...minimo, ENTORNO: 'test' }).simulacionHabilitada).toBe(false);
  });

  it('URL_PUBLICA sin barra final y sólo http(s)', () => {
    expect(
      leerConfiguracion({ ...minimo, URL_PUBLICA: 'https://api.ejemplo.ar/' }).urlPublica,
    ).toBe('https://api.ejemplo.ar');
    expect(problemasDe({ ...minimo, URL_PUBLICA: 'ftp://x' })[0]).toMatch(/URL_PUBLICA/);
  });

  it('un proveedor de archivos en la nube todavía no está disponible', () => {
    expect(problemasDe({ ...minimo, ARCHIVOS_PROVEEDOR: 'supabase' })[0]).toMatch(
      /todavía no está disponible/,
    );
  });

  it('junta todos los problemas en un solo mensaje', () => {
    expect(problemasDe({ DB_MOTOR: 'postgres', PUERTO: 'x' })).toHaveLength(3);
  });

  it('ignora las variables vacías', () => {
    expect(leerConfiguracion({ ...minimo, URL_PUBLICA: '', RELOJ_FIJO: '  ' }).urlPublica).toBe(
      null,
    );
  });
});
