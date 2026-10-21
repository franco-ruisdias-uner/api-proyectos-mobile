import { crearDataSource, opcionesDeBase } from '../common/db/options.js';
import {
  buildConfiguration,
  type Configuration,
} from '../config/configuration.js';

// `pnpm db:probar`: con la configuración del .env, se conecta a la base, muestra motor, versión
// y esquema, crea y borra una tabla de prueba, y dice en castellano qué salió mal.
// El .env lo carga Node (`--env-file-if-exists=.env` en el script de package.json).

let config: Configuration;
try {
  config = buildConfiguration(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
const db = config.database;

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
    return 'Falló el cifrado (SSL). Probá DB_SSL=no-verify, o bajá el certificado de la CA del proveedor y poné su ruta en DB_SSL_CA.';
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

console.log(`Motor: ${db.engine}${db.provider ? ` (${db.provider})` : ''}`);
let ds;
try {
  const opciones = opcionesDeBase({
    ...db,
    synchronize: false,
    dropSchema: false,
  });
  ds = await crearDataSource({ ...opciones, entities: [] } as never);
} catch (error) {
  console.error(`✗ No se pudo conectar. ${explicar(error)}`);
  process.exit(1);
}
try {
  const version = (await ds.query(
    db.engine === 'better-sqlite3'
      ? 'SELECT sqlite_version() AS v'
      : 'SELECT version() AS v',
  )) as Array<{ v: string }>;
  console.log(`Versión: ${version[0]?.v}`);
  if (db.engine === 'postgres') {
    const esquema = (await ds.query('SELECT current_schema() AS e')) as Array<{
      e: string;
    }>;
    console.log(
      `Esquema: ${esquema[0]?.e}${db.schema ? ` (DB_SCHEMA=${db.schema})` : ''}`,
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
