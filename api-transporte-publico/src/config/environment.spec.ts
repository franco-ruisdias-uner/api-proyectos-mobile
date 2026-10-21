import { ErrorDeConfiguracion, leerConfiguracion } from './environment.js';

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
    expect(c.db).toMatchObject({
      motor: 'better-sqlite3',
      url: null,
      archivo: 'datos/api.sqlite',
      sincronizar: true,
      proveedor: null,
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

  it('un proveedor de archivos en la nube pide sus variables', () => {
    expect(problemasDe({ ...minimo, ARCHIVOS_PROVEEDOR: 'supabase' }).join(' ')).toMatch(
      /SUPABASE_PROYECTO.*S3_BUCKET.*S3_REGION.*S3_ACCESS_KEY_ID/,
    );
  });

  it('con un emulador de S3 no pide nada y deja la config S3 lista', () => {
    const c = leerConfiguracion({ ...minimo, ARCHIVOS_PROVEEDOR: 's3proxy' });
    expect(c.archivos.s3).toMatchObject({ endpoint: 'http://s3:8080', crearBucket: true });
  });

  it('ARCHIVOS_REDIRIGIR sólo con proveedores en la nube', () => {
    expect(problemasDe({ ...minimo, ARCHIVOS_REDIRIGIR: 'true' })[0]).toMatch(/ARCHIVOS_REDIRIGIR/);
    expect(
      leerConfiguracion({ ...minimo, ARCHIVOS_PROVEEDOR: 's3proxy', ARCHIVOS_REDIRIGIR: 'true' })
        .archivos.redirigir,
    ).toBe(true);
  });

  it('DB_PROVEEDOR completa motor, SSL y esquema', () => {
    const c = leerConfiguracion({
      ...minimo,
      DB_PROVEEDOR: 'supabase',
      DB_URL: 'postgres://postgres.abc:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
    });
    expect(c.db).toMatchObject({ motor: 'postgres', ssl: 'si-sin-verificar', esquema: 'api' });
  });

  it('los problemas de la base se suman a los demás', () => {
    expect(problemasDe({ DB_PROVEEDOR: 'neon' })).toHaveLength(2); // JWT_SECRETO y DB_URL
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

describe('AGENTS §18.2 — ENTORNO=publicado', () => {
  const buena = {
    ENTORNO: 'publicado',
    JWT_SECRETO: 'x'.repeat(40),
    DB_PROVEEDOR: 'supabase',
    DB_URL: 'postgres://postgres.abc:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
    ARCHIVOS_PROVEEDOR: 'supabase',
    SUPABASE_PROYECTO: 'abc',
    S3_BUCKET: 'archivos',
    S3_REGION: 'sa-east-1',
    S3_ACCESS_KEY_ID: 'a',
    S3_SECRET_ACCESS_KEY: 'b',
  };

  it('una configuración completa arranca, sin simulación', () => {
    const c = leerConfiguracion(buena);
    expect(c.entorno).toBe('publicado');
    expect(c.simulacionHabilitada).toBe(false);
  });

  it('no arranca con SQLite', () => {
    const { DB_PROVEEDOR: _p, DB_URL: _u, ...sinBase } = buena;
    const p = problemasDe(sinBase);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/no se puede usar con SQLite.*DB_PROVEEDOR=supabase/);
  });

  it('no arranca con archivos locales', () => {
    const p = problemasDe({ ...buena, ARCHIVOS_PROVEEDOR: 'local' });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/ARCHIVOS_PROVEEDOR=local.*ARCHIVOS_PROVEEDOR=supabase/);
  });

  it('no arranca con el JWT_SECRETO de desarrollo', () => {
    const p = problemasDe({ ...buena, JWT_SECRETO: 'solo-para-desarrollo-no-usar-en-produccion' });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/JWT_SECRETO de desarrollo/);
  });

  it('no arranca con un JWT_SECRETO corto', () => {
    expect(problemasDe({ ...buena, JWT_SECRETO: 'corto' })[0]).toMatch(/al menos 32 caracteres/);
  });

  it('no arranca con la simulación habilitada', () => {
    expect(problemasDe({ ...buena, SIMULACION_HABILITADA: 'true' })[0]).toMatch(
      /SIMULACION_HABILITADA/,
    );
  });

  it('junta todos los motivos', () => {
    expect(
      problemasDe({ ENTORNO: 'publicado', JWT_SECRETO: 'corto', SIMULACION_HABILITADA: 'true' }),
    ).toHaveLength(4);
  });
});
