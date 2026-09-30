// pnpm db:reiniciar — borra el esquema, lo vuelve a crear desde las entidades y siembra los
// datos de demo (AGENTS §5.2). Es el comando para volver todo al estado inicial.
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ErrorDeConfiguracion, leerConfiguracion } from '../config/configuracion.js';

async function reiniciar(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  let motor: string;
  try {
    motor = leerConfiguracion(process.env).db.motor;
  } catch (error) {
    if (error instanceof ErrorDeConfiguracion) {
      console.error(`\n${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  const { AppModule } = await import('../app.module.js');
  const { Reloj } = await import('../comun/reloj/reloj.js');
  const { sembrar } = await import('./sembrar.js');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const dataSource = app.get<DataSource>(getDataSourceToken());
    console.log(`Borrando y creando el esquema en ${motor}…`);
    await dataSource.synchronize(true);
    console.log('Cargando los datos de demo…');
    await sembrar(dataSource, app.get(Reloj));
    console.log('Listo: la base quedó en el estado inicial.');
  } finally {
    await app.close();
  }
}

await reiniciar();
