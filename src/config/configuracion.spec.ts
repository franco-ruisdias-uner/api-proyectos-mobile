import { ErrorDeConfiguracion, validarEntorno } from './configuracion.js';

const minimo = { JWT_SECRETO: 'un-secreto' };

function problemas(entorno: Record<string, string>): string[] {
  try {
    validarEntorno(entorno);
  } catch (error) {
    if (error instanceof ErrorDeConfiguracion) return error.problemas;
    throw error;
  }
  return [];
}

describe('AGENTS §11.3 — La configuración se valida al arrancar', () => {
  it('con lo mínimo arranca en SQLite, puerto 3000, archivos en disco', () => {
    const c = validarEntorno(minimo);
    expect(c.db).toEqual({
      motor: 'better-sqlite3',
      url: null,
      archivo: 'datos/api.sqlite',
      sincronizar: true,
      proveedor: null,
      ssl: 'no',
      sslCa: null,
      esquema: null,
    });
    expect(c.puerto).toBe(3000);
    expect(c.archivos).toEqual({
      proveedor: 'local',
      directorio: './archivos',
      s3: null,
    });
    expect(c.entorno).toBe('desarrollo');
    expect(c.simulacionHabilitada).toBe(true);
    expect(c.notificaciones).toBe('registro');
    expect(c.relojFijo).toBeNull();
  });

  it('sin JWT_SECRETO no arranca y dice qué falta', () => {
    expect(problemas({})).toEqual([
      expect.stringContaining('Falta JWT_SECRETO'),
    ]);
  });

  it('PUERTO manda; si no está, se usa PORT (lo que inyectan Render y Koyeb)', () => {
    expect(validarEntorno({ ...minimo, PORT: '10000' }).puerto).toBe(10000);
    expect(
      validarEntorno({ ...minimo, PORT: '10000', PUERTO: '4000' }).puerto,
    ).toBe(4000);
    expect(problemas({ ...minimo, PUERTO: 'abc' })).toEqual([
      expect.stringContaining('PUERTO'),
    ]);
  });

  it.each(['postgres', 'mysql', 'mariadb'])(
    'con DB_MOTOR=%s pide DB_URL',
    (motor) => {
      expect(problemas({ ...minimo, DB_MOTOR: motor })).toEqual([
        expect.stringContaining('falta DB_URL'),
      ]);
      expect(
        validarEntorno({
          ...minimo,
          DB_MOTOR: motor,
          DB_URL: 'postgres://a:b@localhost:5432/c',
        }).db.motor,
      ).toBe(motor);
    },
  );

  it('un motor que no existe se rechaza nombrando las opciones', () => {
    expect(problemas({ ...minimo, DB_MOTOR: 'sqlite' })).toEqual([
      expect.stringContaining('better-sqlite3, postgres, mysql, mariadb'),
    ]);
  });

  it('los booleanos son "true" o "false"', () => {
    expect(problemas({ ...minimo, DB_SINCRONIZAR: 'si' })).toEqual([
      expect.stringContaining('DB_SINCRONIZAR'),
    ]);
  });

  it('RELOJ_FIJO tiene que ser un instante con zona', () => {
    expect(
      validarEntorno({ ...minimo, RELOJ_FIJO: '2026-11-14T21:00:00-03:00' })
        .relojFijo,
    ).toBe('2026-11-14T21:00:00-03:00');
    expect(problemas({ ...minimo, RELOJ_FIJO: '2026-11-14 21:00' })).toEqual([
      expect.stringContaining('RELOJ_FIJO'),
    ]);
  });

  it('URL_PUBLICA se guarda sin barra final y tiene que ser http(s)', () => {
    expect(
      validarEntorno({ ...minimo, URL_PUBLICA: 'https://api.ejemplo.ar/' })
        .urlPublica,
    ).toBe('https://api.ejemplo.ar');
    expect(problemas({ ...minimo, URL_PUBLICA: 'api.ejemplo.ar' })).toEqual([
      expect.stringContaining('URL_PUBLICA'),
    ]);
  });

  it('un proveedor de archivos en la nube pide sus variables y dice cuáles faltan', () => {
    expect(problemas({ ...minimo, ARCHIVOS_PROVEEDOR: 'supabase' })).toEqual([
      expect.stringContaining('SUPABASE_PROYECTO'),
    ]);
  });

  it('con S3Proxy no hace falta nada más', () => {
    const c = validarEntorno({ ...minimo, ARCHIVOS_PROVEEDOR: 's3proxy' });
    expect(c.archivos.s3?.endpoint).toBe('http://s3:8080');
  });

  it('DB_PROVEEDOR=supabase fija motor PostgreSQL y esquema api', () => {
    const c = validarEntorno({
      ...minimo,
      DB_PROVEEDOR: 'supabase',
      DB_URL:
        'postgres://postgres.abc:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
    });
    expect(c.db).toMatchObject({
      motor: 'postgres',
      esquema: 'api',
      ssl: 'si-sin-verificar',
    });
    expect(
      problemas({
        ...minimo,
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://a:b@x.com/db',
      }),
    ).toEqual([expect.stringContaining('Supabase')]);
  });

  describe('ENTORNO=publicado — AGENTS §18.2: no arranca si algo es de desarrollo', () => {
    const bueno = {
      ENTORNO: 'publicado',
      JWT_SECRETO: 'x'.repeat(32),
      DB_PROVEEDOR: 'neon',
      DB_URL: 'postgres://u:p@ep-1.neon.tech/db',
      ARCHIVOS_PROVEEDOR: 'r2',
      R2_CUENTA: 'cu',
      S3_BUCKET: 'b',
      S3_ACCESS_KEY_ID: 'i',
      S3_SECRET_ACCESS_KEY: 's',
    };
    it('una configuración completa arranca', () => {
      expect(problemas(bueno)).toEqual([]);
    });
    it.each([
      ['SQLite', { DB_PROVEEDOR: '', DB_URL: '' }, 'SQLite'],
      [
        'archivos locales',
        { ARCHIVOS_PROVEEDOR: 'local' },
        'ARCHIVOS_PROVEEDOR=local',
      ],
      [
        'JWT de desarrollo',
        { JWT_SECRETO: 'solo-para-desarrollo-no-usar-en-produccion' },
        'JWT_SECRETO',
      ],
      ['JWT corto', { JWT_SECRETO: 'corto' }, 'JWT_SECRETO'],
      [
        'simulación',
        { SIMULACION_HABILITADA: 'true' },
        'SIMULACION_HABILITADA',
      ],
    ])('%s', (_n, cambio, texto) => {
      expect(problemas({ ...bueno, ...cambio })).toEqual([
        expect.stringContaining(texto),
      ]);
    });
  });

  it('junta todos los problemas en un solo mensaje en castellano', () => {
    const lista = problemas({ DB_MOTOR: 'postgres', PUERTO: '0' });
    expect(lista).toHaveLength(3);
    expect(() => validarEntorno({})).toThrow(/La API no puede arrancar/);
  });

  it('en test la simulación arranca apagada salvo que se pida', () => {
    expect(
      validarEntorno({ ...minimo, ENTORNO: 'test' }).simulacionHabilitada,
    ).toBe(false);
  });
});

describe('DB_SSL sin DB_PROVEEDOR', () => {
  it('un valor fuera de no|si|si-sin-verificar no arranca', () => {
    expect(problemas({ JWT_SECRETO: 'x', DB_SSL: 'quizas' })).toEqual([
      expect.stringContaining('DB_SSL'),
    ]);
    expect(validarEntorno({ JWT_SECRETO: 'x', DB_SSL: 'si' }).db.ssl).toBe(
      'si',
    );
  });
});
