import { DataSource, Table, type DataSourceOptions } from 'typeorm';
import { opcionesTypeOrm } from '../comun/db/opciones.js';
import { explicarErrorDeBase } from '../comun/db/proveedores.js';
import { entornoDeHerramienta } from './entorno-herramienta.js';

/**
 * `pnpm db:probar`: con la configuración del .env, se conecta, muestra motor, versión y esquema,
 * crea y borra una tabla de prueba y dice en castellano qué salió mal (AGENTS §18.2).
 * No corre en la CI: necesita una base real.
 */
const entorno = entornoDeHerramienta();
const {
  autoLoadEntities: _a,
  retryAttempts: _r,
  retryDelay: _d,
  ...opciones
} = opcionesTypeOrm(entorno);
const dataSource = new DataSource({ ...opciones, synchronize: false } as DataSourceOptions);

try {
  await dataSource.initialize();
  const version = (dataSource.driver as unknown as { version?: string }).version ?? 'desconocida';
  console.log(
    `✓ Conectó a ${entorno.dbMotor}${entorno.dbProveedor ? ` (${entorno.dbProveedor})` : ''}, versión ${version}.`,
  );
  console.log(`  Esquema: ${entorno.dbEsquema ?? '(el de la conexión)'}`);

  const runner = dataSource.createQueryRunner();
  try {
    if (entorno.dbMotor === 'postgres' && entorno.dbEsquema) {
      await runner.createSchema(entorno.dbEsquema, true);
    }
    const nombre = `${entorno.dbEsquema ? `${entorno.dbEsquema}.` : ''}prueba_conexion`;
    await runner.dropTable(nombre, true);
    await runner.createTable(
      new Table({ name: nombre, columns: [{ name: 'id', type: 'int', isPrimary: true }] }),
    );
    console.log('✓ Pudo crear una tabla de prueba.');
    await runner.dropTable(nombre);
    console.log('✓ Pudo borrarla. Todo en orden.');
  } finally {
    await runner.release();
  }
  await dataSource.destroy();
} catch (error) {
  console.error(`\n✗ No anduvo: ${explicarErrorDeBase(error as Error, entorno.dbSsl)}\n`);
  process.exit(1);
}
