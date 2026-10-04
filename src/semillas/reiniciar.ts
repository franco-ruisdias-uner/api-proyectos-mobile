// `pnpm db:reiniciar`: borra el esquema, lo crea desde las entidades y siembra.
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';

if (existsSync('.env')) process.loadEnvFile('.env');

const { AppModule } = await import('../app.module.js');
const { DataSource } = await import('typeorm');
const { Reloj } = await import('../comun/reloj/reloj.js');
const { sembrar } = await import('./sembrar.js');
const { validarEntorno } = await import('../config/configuracion.js');

try {
  validarEntorno(process.env);
  const app = await NestFactory.createApplicationContext(
    AppModule.registrar({ borrarEsquema: true, omitirSembradoInicial: true }),
    {
      logger: ['error', 'warn'],
      abortOnError: false,
    },
  );
  await sembrar(app.get(DataSource), app.get(Reloj));
  await app.close();
  console.log('Listo: la base quedó vacía y con los datos de demo.');
} catch (error) {
  console.error(`No se pudo reiniciar la base: ${(error as Error).message}`);
  process.exit(1);
}
