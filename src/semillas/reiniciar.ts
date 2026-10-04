// `pnpm db:reiniciar`: borra el esquema, lo crea desde las entidades y siembra.
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';

if (existsSync('.env')) process.loadEnvFile('.env');

const { AppModule } = await import('../app.module.js');
const { DataSource } = await import('typeorm');
const { Reloj } = await import('../comun/reloj/reloj.js');
const { AlmacenArchivos } =
  await import('../comun/archivos/almacen-archivos.js');
const { sembrar } = await import('./sembrar.js');
const { validarEntorno } = await import('../config/configuracion.js');

try {
  const config = validarEntorno(process.env);
  // Contra una base en la nube hay que confirmar: borra el esquema de la API (AGENTS §5.2).
  if (config.db.proveedor !== null && !process.argv.includes('--confirmar')) {
    console.error(
      `Esto borra todos los datos del esquema «${config.db.esquema ?? 'de la base'}» en ${config.db.proveedor}. ` +
        'Si es lo que querés, repetilo con --confirmar: pnpm db:reiniciar --confirmar',
    );
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(
    AppModule.registrar({ borrarEsquema: true, omitirSembradoInicial: true }),
    {
      logger: ['error', 'warn'],
      abortOnError: false,
    },
  );
  await sembrar(app.get(DataSource), app.get(Reloj), app.get(AlmacenArchivos));
  await app.close();
  console.log('Listo: la base quedó vacía y con los datos de demo.');
} catch (error) {
  console.error(`No se pudo reiniciar la base: ${(error as Error).message}`);
  process.exit(1);
}
