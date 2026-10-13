import { existsSync } from 'node:fs';

// `pnpm db:probar`: con la configuración del .env, se conecta a la base, muestra motor, versión
// y esquema, crea y borra una tabla de prueba, y dice en castellano qué salió mal.
if (existsSync('.env')) process.loadEnvFile('.env');

const { leerEntorno } = await import('../config/entorno.js');
const { opcionesDeBase, crearDataSource } =
  await import('../comun/db/opciones.js');

let entorno;
try {
  entorno = leerEntorno(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

function explicar(error: unknown): string {
  const m = String((error as Error).message ?? error);
  const codigo = (error as { code?: string }).code ?? '';
  if (
    /password authentication failed|Access denied|28P01|ER_ACCESS_DENIED/i.test(
      m + codigo,
    )
  )
    return 'La base rechazó el usuario o la contraseña. Revisá DB_URL (si la clave tiene @, / o #, codificalos: @ → %40).';
  if (/SSL|TLS|certificate|self[- ]signed/i.test(m))
    return 'Falló el cifrado (SSL). Probá DB_SSL=si-sin-verificar, o bajá el certificado de la CA del proveedor y poné su ruta en DB_SSL_CA.';
  if (/ENOTFOUND|EAI_AGAIN/.test(m + codigo))
    return 'No se encontró el servidor. Revisá el host de DB_URL (y que tengas internet).';
  if (/ENETUNREACH|EHOSTUNREACH/.test(m + codigo))
    return 'No hay ruta hasta ese servidor (puede ser IPv6). Con Supabase, usá el pooler en modo sesión, no la conexión directa.';
  if (/ECONNREFUSED|ETIMEDOUT/.test(m + codigo))
    return 'El servidor no responde. Si es un plan gratis, puede estar pausado: reactivalo desde el panel. Revisá también el puerto.';
  if (/prepared statement|pgbouncer/i.test(m))
    return 'Parece el pooler en modo transacción. Usá el modo sesión (puerto 5432).';
  return m;
}

console.log(
  `Motor: ${entorno.DB_MOTOR}${entorno.DB_PROVEEDOR ? ` (${entorno.DB_PROVEEDOR})` : ''}`,
);
let ds;
try {
  const opciones = opcionesDeBase({
    ...entorno,
    DB_SINCRONIZAR: false,
    DB_BORRAR_AL_CONECTAR: false,
  });
  ds = await crearDataSource({ ...opciones, entities: [] } as never);
} catch (error) {
  console.error(`✗ No se pudo conectar. ${explicar(error)}`);
  process.exit(1);
}
try {
  const version = (await ds.query(
    entorno.DB_MOTOR === 'better-sqlite3'
      ? 'SELECT sqlite_version() AS v'
      : 'SELECT version() AS v',
  )) as Array<{ v: string }>;
  console.log(`Versión: ${version[0]?.v}`);
  if (entorno.DB_MOTOR === 'postgres') {
    const esquema = (await ds.query('SELECT current_schema() AS e')) as Array<{
      e: string;
    }>;
    console.log(
      `Esquema: ${esquema[0]?.e}${entorno.DB_ESQUEMA ? ` (DB_ESQUEMA=${entorno.DB_ESQUEMA})` : ''}`,
    );
  }
  const corredor = ds.createQueryRunner();
  try {
    await corredor.query('CREATE TABLE prueba_conexion (id int)');
    await corredor.query('DROP TABLE prueba_conexion');
  } finally {
    await corredor.release();
  }
  console.log(
    '✓ Se conectó, creó una tabla de prueba y la borró. La base está lista.',
  );
} catch (error) {
  console.error(
    `✗ Se conectó, pero no pudo crear una tabla de prueba. ${explicar(error)}`,
  );
  process.exitCode = 1;
} finally {
  await ds.destroy();
}
