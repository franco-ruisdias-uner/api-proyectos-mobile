import { configuracionBase, hayProblemasDb } from './proveedores.js';

const SUPA =
  'postgres://postgres.abcdefgh:clave@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

function ok(v: Record<string, string>) {
  const r = configuracionBase(v);
  if (r === null || hayProblemasDb(r)) throw new Error(JSON.stringify(r));
  return r;
}
function problemas(v: Record<string, string>): string {
  const r = configuracionBase(v);
  if (r === null || !hayProblemasDb(r))
    throw new Error('se esperaban problemas');
  return r.problemas.join('\n');
}

describe('AGENTS §18.1 — Presets de base de datos', () => {
  it('sin DB_PROVEEDOR no hay preset', () => {
    expect(configuracionBase({ DB_MOTOR: 'postgres' })).toBeNull();
  });

  it('supabase: postgres, esquema api, cifrado sin verificar', () => {
    expect(ok({ DB_PROVEEDOR: 'supabase', DB_URL: SUPA })).toMatchObject({
      motor: 'postgres',
      esquema: 'api',
      ssl: 'si-sin-verificar',
      sslCa: null,
    });
  });

  it('DB_ESQUEMA, DB_SSL y DB_SSL_CA pisan el preset', () => {
    expect(
      ok({
        DB_PROVEEDOR: 'supabase',
        DB_URL: SUPA,
        DB_ESQUEMA: 'otro',
        DB_SSL: 'si',
        DB_SSL_CA: 'certs/ca.pem',
      }),
    ).toMatchObject({ esquema: 'otro', ssl: 'si', sslCa: 'certs/ca.pem' });
  });

  it('supabase: la conexión directa (IPv6) se rechaza y dice cuál usar', () => {
    const m = problemas({
      DB_PROVEEDOR: 'supabase',
      DB_URL: 'postgres://postgres:x@db.abcdefgh.supabase.co:5432/postgres',
    });
    expect(m).toContain('IPv6');
    expect(m).toContain('Session pooler');
  });

  it('supabase: el modo transacción (6543) se rechaza', () => {
    const m = problemas({
      DB_PROVEEDOR: 'supabase',
      DB_URL: SUPA.replace(':5432', ':6543'),
    });
    expect(m).toContain('modo transacción');
    expect(m).toContain('5432');
  });

  it('supabase: usuario sin la referencia del proyecto', () => {
    expect(
      problemas({
        DB_PROVEEDOR: 'supabase',
        DB_URL: SUPA.replace('postgres.abcdefgh', 'postgres'),
      }),
    ).toContain('postgres.<referencia');
  });

  it('supabase: un host que no es del pooler', () => {
    expect(
      problemas({
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://u:p@localhost:5432/api',
      }),
    ).toContain('pooler');
  });

  it('neon: cifrado y verificado, esquema public', () => {
    expect(
      ok({
        DB_PROVEEDOR: 'neon',
        DB_URL: 'postgres://u:p@ep-x-123.sa-east-1.aws.neon.tech/neondb',
      }),
    ).toMatchObject({ motor: 'postgres', ssl: 'si', esquema: 'public' });
    expect(
      problemas({ DB_PROVEEDOR: 'neon', DB_URL: 'postgres://u:p@otro.com/x' }),
    ).toContain('.neon.tech');
  });

  it('aiven-postgres y aiven-mysql', () => {
    expect(
      ok({
        DB_PROVEEDOR: 'aiven-postgres',
        DB_URL: 'postgres://u:p@pg-x.aivencloud.com:1234/defaultdb',
      }),
    ).toMatchObject({ motor: 'postgres', esquema: 'public' });
    expect(
      ok({
        DB_PROVEEDOR: 'aiven-mysql',
        DB_URL: 'mysql://u:p@my-x.aivencloud.com:1234/defaultdb',
      }),
    ).toMatchObject({ motor: 'mysql', esquema: null, ssl: 'si-sin-verificar' });
    expect(
      problemas({
        DB_PROVEEDOR: 'aiven-mysql',
        DB_URL: 'mysql://u:p@otro.com/x',
      }),
    ).toContain('.aivencloud.com');
  });

  it('contraseña con caracteres raros codificados: se parsea con URL', () => {
    const r = ok({
      DB_PROVEEDOR: 'supabase',
      DB_URL: SUPA.replace('clave', 'p%40ss%2Fw%23rd'),
    });
    expect(new URL(r.url).password).toBe('p%40ss%2Fw%23rd');
  });

  it('falta DB_URL, protocolo equivocado, DB_SSL inválido, motor que no coincide', () => {
    expect(problemas({ DB_PROVEEDOR: 'neon' })).toContain('Falta DB_URL');
    expect(
      problemas({
        DB_PROVEEDOR: 'aiven-mysql',
        DB_URL: 'postgres://u:p@x.aivencloud.com/x',
      }),
    ).toContain('mysql://');
    expect(
      problemas({ DB_PROVEEDOR: 'supabase', DB_URL: SUPA, DB_SSL: 'quizas' }),
    ).toContain('DB_SSL');
    expect(
      problemas({ DB_PROVEEDOR: 'supabase', DB_URL: SUPA, DB_MOTOR: 'mysql' }),
    ).toContain('DB_MOTOR');
  });

  it('un proveedor que no existe', () => {
    expect(problemas({ DB_PROVEEDOR: 'oracle' })).toContain('no existe');
  });
});
