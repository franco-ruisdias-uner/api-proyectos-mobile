import { configuracionBase } from './providers.js';

const sb =
  'postgres://postgres.abcd:cl%40ve@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';
const err = (e: Record<string, string>) =>
  (configuracionBase(e) as { error: string }).error;

describe('AGENTS §18.1 — presets de base de datos', () => {
  it('sin DB_PROVEEDOR no hace nada', () => {
    expect(configuracionBase({ DB_URL: 'x' })).toBeNull();
  });
  it('supabase: pooler en modo sesión, esquema api, SSL sin verificar', () => {
    expect(configuracionBase({ DB_PROVEEDOR: 'supabase', DB_URL: sb })).toEqual(
      {
        motor: 'postgres',
        ssl: 'si-sin-verificar',
        esquema: 'api',
      },
    );
  });
  it('supabase: con DB_SSL_CA pasa a verificar', () => {
    expect(
      configuracionBase({
        DB_PROVEEDOR: 'supabase',
        DB_URL: sb,
        DB_SSL_CA: 'ca.pem',
      }),
    ).toMatchObject({ ssl: 'si' });
  });
  it('supabase: rechaza la conexión directa (IPv6)', () => {
    expect(
      err({
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres:x@db.abcd.supabase.co:5432/postgres',
      }),
    ).toContain('IPv6');
  });
  it('supabase: rechaza el modo transacción (6543)', () => {
    expect(
      err({ DB_PROVEEDOR: 'supabase', DB_URL: sb.replace('5432', '6543') }),
    ).toContain('modo sesión');
  });
  it('supabase: rechaza un usuario sin referencia y un host ajeno', () => {
    expect(
      err({
        DB_PROVEEDOR: 'supabase',
        DB_URL: sb.replace('postgres.abcd', 'postgres'),
      }),
    ).toContain('postgres.<referencia');
    expect(
      err({
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://a:b@example.com:5432/x',
      }),
    ).toContain('no parece de Supabase');
  });
  it('neon: SSL verificado, esquema public, host .neon.tech', () => {
    expect(
      configuracionBase({
        DB_PROVEEDOR: 'neon',
        DB_URL: 'postgres://u:p@ep-1.sa-east-1.aws.neon.tech/db',
      }),
    ).toEqual({ motor: 'postgres', ssl: 'si', esquema: 'public' });
    expect(
      err({ DB_PROVEEDOR: 'neon', DB_URL: 'postgres://u:p@otro.com/db' }),
    ).toContain('Neon');
  });
  it('aiven: postgres y mysql', () => {
    expect(
      configuracionBase({
        DB_PROVEEDOR: 'aiven-postgres',
        DB_URL: 'postgres://u:p@pg-x.aivencloud.com:1/db',
      }),
    ).toMatchObject({ motor: 'postgres', esquema: 'public' });
    expect(
      configuracionBase({
        DB_PROVEEDOR: 'aiven-mysql',
        DB_URL: 'mysql://u:p@my-x.aivencloud.com:1/db',
      }),
    ).toEqual({ motor: 'mysql', ssl: 'si-sin-verificar', esquema: null });
    expect(
      err({
        DB_PROVEEDOR: 'aiven-mysql',
        DB_URL: 'postgres://u:p@my-x.aivencloud.com:1/db',
      }),
    ).toContain('mysql://');
  });
  it('errores generales: proveedor desconocido, sin URL, URL rota, SSL y esquema mal', () => {
    expect(err({ DB_PROVEEDOR: 'otro' })).toContain('supabase');
    expect(err({ DB_PROVEEDOR: 'neon' })).toContain('falta DB_URL');
    expect(err({ DB_PROVEEDOR: 'neon', DB_URL: 'nada' })).toContain(
      'no es una dirección',
    );
    const url = 'postgres://u:p@ep-1.neon.tech/db';
    expect(
      err({ DB_PROVEEDOR: 'neon', DB_URL: url, DB_SSL: 'quizas' }),
    ).toContain('DB_SSL');
    expect(
      err({ DB_PROVEEDOR: 'neon', DB_URL: url, DB_ESQUEMA: 'Mal Nombre' }),
    ).toContain('DB_ESQUEMA');
  });
  it('DB_ESQUEMA pisa el del preset', () => {
    expect(
      configuracionBase({
        DB_PROVEEDOR: 'neon',
        DB_URL: 'postgres://u:p@ep-1.neon.tech/db',
        DB_ESQUEMA: 'reservas',
      }),
    ).toMatchObject({ esquema: 'reservas' });
  });
});
