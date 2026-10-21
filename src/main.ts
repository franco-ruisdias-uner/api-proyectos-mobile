import './config/load-env.js';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configurarApp, OPCIONES_APP } from './setup-app.js';
import { validarEntorno } from './config/environment.js';

function direccionesDeRed(puerto: number): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i!.address}:${puerto}`);
}

async function arrancar() {
  let entorno;
  try {
    entorno = validarEntorno(process.env);
  } catch (error) {
    console.error(`\n${(error as Error).message}\n`);
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.crear(entorno),
    OPCIONES_APP,
  );
  configurarApp(app, entorno);
  app.enableShutdownHooks();
  await app.listen(entorno.puerto, '0.0.0.0');

  const logger = new Logger('API');
  logger.log(`Escuchando en el puerto ${entorno.puerto} (base: ${entorno.dbMotor}).`);
  if (existsSync('/.dockerenv')) {
    logger.log(
      `Corriendo dentro de Docker: desde el teléfono usá la IP de tu computadora, ` +
        `por ejemplo http://192.168.0.10:${entorno.puerto}/salud (no la del contenedor).`,
    );
  } else {
    logger.log(`En esta computadora: http://localhost:${entorno.puerto}/salud`);
    for (const url of direccionesDeRed(entorno.puerto)) {
      logger.log(`Desde el teléfono (misma red wifi): ${url}/salud`);
    }
  }
  logger.log(`Documentación: http://localhost:${entorno.puerto}/docs`);
}

await arrancar();
