import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ErrorDeConfiguracion, leerConfiguracion } from './config/configuracion.js';

function direccionesDeRed(puerto: number): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i !== undefined && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i!.address}:${puerto}`);
}

async function arrancar(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');

  // Se valida antes de cargar la app, para que un error de configuración salga claro.
  let configuracion;
  try {
    configuracion = leerConfiguracion(process.env);
  } catch (error) {
    if (error instanceof ErrorDeConfiguracion) {
      console.error(`\n${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  const { AppModule } = await import('./app.module.js');
  const { configurarAplicacion } = await import('./aplicacion.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarAplicacion(app);
  app.enableShutdownHooks();
  await app.listen(configuracion.puerto, '0.0.0.0');

  const registro = new Logger('API');
  const puerto = configuracion.puerto;
  registro.log(`La API está escuchando en el puerto ${puerto}.`);
  registro.log(
    `En esta computadora: http://localhost:${puerto}  ·  Documentación: http://localhost:${puerto}/docs`,
  );
  if (existsSync('/.dockerenv')) {
    registro.log(
      'Estás en Docker: desde el teléfono usá la IP de tu computadora (no la del contenedor), ' +
        `por ejemplo http://192.168.0.10:${process.env.PUERTO_PUBLICADO ?? puerto}.`,
    );
  } else {
    for (const url of direccionesDeRed(puerto)) {
      registro.log(`Desde el teléfono (misma red wifi): ${url}  → probá ${url}/salud`);
    }
  }
}

await arrancar();
