// pnpm db:reiniciar — borra el esquema, lo vuelve a crear desde las entidades y siembra.
import 'reflect-metadata';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const { NestFactory } = await import('@nestjs/core');
const { getDataSourceToken } = await import('@nestjs/typeorm');
const { AppModule } = await import('../app.module.js');
const { AlmacenArchivos } =
  await import('../comun/archivos/almacen-archivos.js');
const { Reloj } = await import('../comun/reloj/reloj.js');
const { ErrorDeConfiguracion, validarEntorno } =
  await import('../config/entorno.js');
const { sembrar } = await import('./sembrar.js');
type DataSource = import('typeorm').DataSource;

try {
  const entornoValidado = validarEntorno(process.env);
  // Contra una base en la nube se borra datos de verdad: pide confirmación explícita.
  if (entornoValidado.BASE.proveedor && !process.argv.includes('--confirmar')) {
    const donde = entornoValidado.BASE.esquema
      ? ` (sólo el esquema «${entornoValidado.BASE.esquema}» de la API)`
      : '';
    console.error(
      `\nLa base es de ${entornoValidado.BASE.proveedor}${donde}: reiniciarla borra sus datos.\nSi es lo que querés, repetí el comando con --confirmar: pnpm db:reiniciar --confirmar\n`,
    );
    process.exit(1);
  }
  // Sin sincronizar al arrancar ni sembrar solo: acá se hace a mano, en orden.
  const app = await NestFactory.createApplicationContext(
    AppModule.registrar({ DB_SINCRONIZAR: 'false', SEMBRAR_SI_VACIA: 'false' }),
    { logger: ['error', 'warn'] },
  );
  const dataSource = app.get<DataSource>(getDataSourceToken());
  console.log(`Base: ${dataSource.options.type}`);
  console.log('Borrando el esquema…');
  await dataSource.dropDatabase();
  console.log('Creando las tablas…');
  await dataSource.synchronize();
  console.log('Cargando los datos de demo…');
  await sembrar(dataSource, app.get(AlmacenArchivos), app.get(Reloj));
  await app.close();
  console.log('Listo. Arrancá la API con: pnpm dev');
} catch (error) {
  console.error(
    error instanceof ErrorDeConfiguracion ? `\n${error.message}\n` : error,
  );
  process.exit(1);
}
