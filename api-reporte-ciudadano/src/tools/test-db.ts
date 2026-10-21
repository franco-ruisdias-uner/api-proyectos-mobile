// pnpm db:probar — con la configuración del .env, se conecta, muestra motor, versión y esquema,
// crea y borra una tabla de prueba en ese esquema, y dice en castellano qué salió mal (AGENTS §18.2).
import 'reflect-metadata';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const { DataSource } = await import('typeorm');
const { opcionesTypeOrm } = await import('../common/db/options.js');
const { ErrorDeConfiguracion, validarEntorno } =
  await import('../config/environment.js');

function explicar(e: unknown): string {
  const m = (e as Error | null)?.message ?? String(e);
  if (/password authentication failed|Access denied|authentication/i.test(m))
    return `La contraseña o el usuario no son correctos (${m}). Revisá DB_URL; si la contraseña tiene @ o /, escribila codificada (%40, %2F).`;
  if (/Tenant or user not found/i.test(m))
    return 'El pooler no reconoce el usuario. En Supabase el usuario es postgres.<referencia del proyecto> y el pooler tiene que ser el de tu región.';
  if (/prepared statement|pgbouncer/i.test(m))
    return 'Estás usando el pooler en modo transacción (puerto 6543). Usá el modo sesión, puerto 5432.';
  if (/certificate|SSL|self.signed/i.test(m))
    return `Falló el certificado SSL (${m}). Probá DB_SSL=si-sin-verificar, o DB_SSL_CA con el certificado de la CA del proveedor.`;
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH/i.test(m))
    return `No se pudo llegar al servidor (${m}). Revisá el host de DB_URL. Con Supabase, usá el pooler (IPv4), no db.<ref>.supabase.co.`;
  return m;
}

try {
  const entorno = validarEntorno(process.env);
  // Sin entidades: sólo se prueba la conexión y el esquema. `retry*` y `autoLoadEntities` son de Nest.
  const { autoLoadEntities, retryAttempts, retryDelay, ...opciones } =
    opcionesTypeOrm(entorno) as Record<string, unknown>;
  void [autoLoadEntities, retryAttempts, retryDelay];
  const dataSource = new DataSource({
    ...opciones,
    synchronize: false,
    entities: [],
  } as unknown as import('typeorm').DataSourceOptions);
  await dataSource.initialize();
  console.log(`✓ Conexión con ${entorno.DB_MOTOR}`);
  const version = await dataSource.query(
    entorno.DB_MOTOR === 'better-sqlite3'
      ? 'SELECT sqlite_version() AS v'
      : 'SELECT version() AS v',
  );
  console.log(`  Versión: ${version[0].v}`);
  const esquema = entorno.BASE.esquema;
  const runner = dataSource.createQueryRunner();
  try {
    if (esquema) {
      await runner.createSchema(esquema, true);
      console.log(`  Esquema: ${esquema}`);
    }
    const nombre = esquema ? `${esquema}.tabla_de_prueba` : 'tabla_de_prueba';
    await runner.query(`CREATE TABLE ${nombre} (id int)`);
    console.log('✓ Crear una tabla de prueba');
    await runner.query(`DROP TABLE ${nombre}`);
    console.log('✓ Borrarla');
  } finally {
    await runner.release();
  }
  await dataSource.destroy();
  console.log('\nTodo bien: la base está bien configurada.');
} catch (e) {
  console.error(
    e instanceof ErrorDeConfiguracion
      ? `\n${e.message}\n`
      : `\n✗ ${explicar(e)}\n`,
  );
  process.exit(1);
}
