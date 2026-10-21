// pnpm db:reiniciar — borra el esquema, lo vuelve a crear desde las entidades y siembra los
// datos de demo (AGENTS §5.2). Es el comando para volver todo al estado inicial.
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ErrorDeConfiguracion, leerConfiguracion } from '../config/environment.js';

async function reiniciar(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  let motor: string;
  try {
    const { db } = leerConfiguracion(process.env);
    motor = db.motor;
    // Contra una base en la nube se pide confirmación y se avisa qué se va a borrar (AGENTS §5.2).
    if (db.proveedor && !process.argv.includes('--confirmar')) {
      const que = db.esquema ? `el esquema «${db.esquema}»` : 'todas las tablas de la base';
      console.error(
        `\nEsto borra ${que} de tu base en ${db.proveedor} y carga de nuevo los datos de demo.\n` +
          'Si es lo que querés, repetí el comando con --confirmar:\n  pnpm db:reiniciar --confirmar\n',
      );
      process.exit(1);
    }
    if (db.esquema) console.log(`Se usa el esquema «${db.esquema}»; los demás no se tocan.`);
  } catch (error) {
    if (error instanceof ErrorDeConfiguracion) {
      console.error(`\n${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  const { AppModule } = await import('../app.module.js');
  const { Reloj } = await import('../common/clock/clock.js');
  const { ArchivosServicio } = await import('../common/files/files.service.js');
  const { sembrar } = await import('./seed.js');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const dataSource = app.get<DataSource>(getDataSourceToken());
    console.log(`Borrando y creando el esquema en ${motor}…`);
    await dataSource.synchronize(true);
    console.log('Cargando los datos de demo…');
    await sembrar(dataSource, app.get(Reloj), app.get(ArchivosServicio));
    console.log('Listo: la base quedó en el estado inicial.');
  } finally {
    await app.close();
  }
}

await reiniciar();
