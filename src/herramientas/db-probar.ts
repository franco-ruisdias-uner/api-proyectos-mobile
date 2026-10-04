// `pnpm db:probar`: con la configuración del .env, se conecta, muestra motor, versión
// y esquema, crea y borra una tabla de prueba y dice en castellano qué salió mal
// (AGENTS §18.2).
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const { DataSource, Table } = await import('typeorm');
const { validarEntorno, ErrorDeConfiguracion } =
  await import('../config/configuracion.js');
const { opcionesDeBase } = await import('../comun/db/opciones.js');
const { mensajeDeSsl } = await import('../comun/db/proveedores.js');

let ds: InstanceType<typeof DataSource> | null = null;
try {
  const config = validarEntorno(process.env);
  const opciones = opcionesDeBase(config);
  ds = new DataSource({
    ...opciones,
    entities: [],
    synchronize: false,
  } as ConstructorParameters<typeof DataSource>[0]);
  await ds.initialize();
  const esquema = config.db.esquema ?? '(el de la conexión)';
  console.log(`Conectado: motor ${config.db.motor}, esquema ${esquema}.`);

  const qr = ds.createQueryRunner();
  try {
    if (config.db.esquema) await qr.createSchema(config.db.esquema, true);
    const nombre = config.db.esquema
      ? `${config.db.esquema}.prueba_conexion`
      : 'prueba_conexion';
    await qr.dropTable(nombre, true);
    await qr.createTable(
      new Table({
        name: nombre,
        columns: [
          { name: 'id', type: 'varchar', length: '10', isPrimary: true },
        ],
      }),
    );
    console.log('  ✓ se pudo crear una tabla de prueba');
    await qr.dropTable(nombre);
    console.log('  ✓ y borrarla');
  } finally {
    await qr.release();
  }
  console.log('Todo bien: la base está bien configurada.');
} catch (error) {
  if (error instanceof ErrorDeConfiguracion) console.error(error.message);
  else {
    const mensaje = (error as Error).message;
    const pista =
      mensajeDeSsl(mensaje) ??
      (/password|authentication|autenticaci/i.test(mensaje)
        ? 'La contraseña o el usuario de DB_URL no son correctos (cuidado con los caracteres raros: van codificados con %).'
        : /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ENETUNREACH/.test(mensaje)
          ? 'No se llegó al servidor: revisá el host y el puerto de DB_URL. Con Supabase, usá el pooler en modo sesión (IPv4), no la conexión directa.'
          : 'Revisá DB_URL.');
    console.error(`No se pudo usar la base: ${mensaje}\n${pista}`);
  }
  process.exitCode = 1;
} finally {
  await ds?.destroy();
}
