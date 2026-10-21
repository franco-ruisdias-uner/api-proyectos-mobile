// pnpm db:probar — con la configuración del .env, se conecta, muestra motor, versión y
// esquema, crea y borra una tabla de prueba en ese esquema, y dice en castellano qué salió mal
// (AGENTS §18.2). No corre en la CI: necesita cuentas reales.
import { existsSync } from 'node:fs';
import { DataSource, Table } from 'typeorm';
import { opcionesDeBase, explicarErrorDeConexion } from '../common/db/options.js';
import { ErrorDeConfiguracion, leerConfiguracion } from '../config/environment.js';

async function probar(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  let config;
  try {
    config = leerConfiguracion(process.env);
  } catch (error) {
    if (error instanceof ErrorDeConfiguracion) {
      console.error(`\n${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  const opciones = opcionesDeBase(config, { reintentos: 1 });
  const dataSource = new DataSource({ ...opciones, synchronize: false, entities: [] } as never);
  let paso = 'conectar';
  try {
    await dataSource.initialize();
    console.log(
      `✓ Conectó con ${config.db.motor}${config.db.proveedor ? ` (${config.db.proveedor})` : ''}.`,
    );
    const ejecutor = dataSource.createQueryRunner();
    try {
      const esquema = config.db.esquema;
      if (esquema) {
        paso = `crear el esquema «${esquema}»`;
        await ejecutor.createSchema(esquema, true);
      }
      const nombre = `${esquema ? `${esquema}.` : ''}prueba_de_conexion`;
      paso = 'crear una tabla de prueba';
      await ejecutor.createTable(
        new Table({ name: nombre, columns: [{ name: 'id', type: 'int', isPrimary: true }] }),
        true,
      );
      console.log(`✓ Creó la tabla de prueba${esquema ? ` en el esquema «${esquema}»` : ''}.`);
      paso = 'borrar la tabla de prueba';
      await ejecutor.dropTable(nombre, true);
      console.log('✓ La borró.');
    } finally {
      await ejecutor.release();
    }
    console.log('\nTodo bien: la base está lista.');
  } catch (error) {
    const explicado = explicarErrorDeConexion(error);
    console.error(`\n✗ Falló al ${paso}.\n${explicado.message}\n`);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

await probar();
