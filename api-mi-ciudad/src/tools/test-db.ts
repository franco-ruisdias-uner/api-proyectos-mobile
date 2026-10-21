import '../config/load-env.js';
import { DataSource, Table } from 'typeorm';
import { crearEsquemaSiHaceFalta, opcionesTypeOrm } from '../common/db/options.js';
import { traducirErrorDeConexion } from '../common/db/providers.js';
import { validarEntorno, type Entorno } from '../config/environment.js';

/**
 * `pnpm db:probar` (AGENTS §18.2): con la configuración del `.env`, se conecta, muestra motor,
 * versión y esquema, crea y borra una tabla de prueba, y dice en castellano qué salió mal.
 * No corre en la CI (necesita una cuenta real).
 */
async function probar(): Promise<void> {
  let entorno: Entorno;
  try {
    entorno = validarEntorno(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  const donde = entorno.DB_PROVEEDOR ?? entorno.DB_MOTOR;
  console.log(`Probando la base (${donde})…`);
  const opciones = { ...opcionesTypeOrm(entorno), entities: [], synchronize: false, dropSchema: false };
  const dataSource = new DataSource(opciones as ConstructorParameters<typeof DataSource>[0]);
  try {
    await crearEsquemaSiHaceFalta(opciones as ConstructorParameters<typeof DataSource>[0]);
    await dataSource.initialize();
    const version = (dataSource.driver as { version?: string }).version ?? 'desconocida';
    console.log(`  ✓ Conexión: motor ${entorno.DB_MOTOR}, versión ${version}.`);
    if (entorno.DB_ESQUEMA) console.log(`  ✓ Esquema de la API: «${entorno.DB_ESQUEMA}».`);
    console.log(
      `  ✓ Cifrado: ${{ no: 'no', si: 'sí, verificando el certificado', 'si-sin-verificar': 'sí, sin verificar el certificado' }[entorno.DB_SSL]}.`,
    );

    const nombre = entorno.DB_ESQUEMA ? `${entorno.DB_ESQUEMA}.prueba_conexion` : 'prueba_conexion';
    const consulta = dataSource.createQueryRunner();
    try {
      await consulta.dropTable(nombre, true);
      await consulta.createTable(
        new Table({
          name: nombre,
          columns: [{ name: 'id', type: 'varchar', length: '40', isPrimary: true }],
        }),
      );
      console.log('  ✓ Se pudo crear una tabla de prueba.');
      await consulta.dropTable(nombre);
      console.log('  ✓ Y borrarla.');
    } finally {
      await consulta.release();
    }
    console.log('\nTodo bien: la base está lista para la API.');
  } catch (error) {
    const explicacion = traducirErrorDeConexion(error, entorno.DB_SSL);
    console.error(
      `\n  ✗ No se pudo usar la base: ${explicacion ?? (error instanceof Error ? error.message : error)}`,
    );
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void probar();
