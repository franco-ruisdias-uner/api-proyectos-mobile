import './config/load-env.js';
import { networkInterfaces } from 'node:os';
import { existsSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AlmacenNoDisponible } from './common/files/file-storage.js';
import { AppModule } from './app.module.js';
import { configurarApp } from './setup-app.js';
import { ENTORNO } from './config/environment.module.js';
import type { Entorno } from './config/environment.js';
import { traducirErrorDeConexion } from './common/db/providers.js';

function direccionesDeRed(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
}

function sslDeEntorno(): 'no' | 'si' | 'si-sin-verificar' {
  const valor = process.env.DB_SSL?.trim();
  return valor === 'si' || valor === 'si-sin-verificar' ? valor : 'no';
}

async function arrancar(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.registrar());
  configurarApp(app);
  const entorno = app.get<Entorno>(ENTORNO);
  await app.listen(entorno.PUERTO, '0.0.0.0');

  const log = new Logger('Mi Ciudad');
  log.log(`API escuchando en el puerto ${entorno.PUERTO} (base: ${entorno.DB_MOTOR}).`);
  log.log(`En esta compu: http://localhost:${entorno.PUERTO}/salud · documentación: /docs`);
  if (existsSync('/.dockerenv')) {
    log.log(
      'Estás dentro de Docker: desde el teléfono usá la IP de tu computadora (no la del contenedor), ' +
        `por ejemplo http://192.168.0.10:${entorno.PUERTO}/salud`,
    );
  } else {
    for (const ip of direccionesDeRed())
      log.log(`Desde el teléfono (misma red wifi): http://${ip}:${entorno.PUERTO}/salud`);
  }
  if (entorno.RELOJ_FIJO) log.warn(`Reloj congelado en ${entorno.RELOJ_FIJO.toISOString()} (RELOJ_FIJO).`);
}

arrancar().catch((error: unknown) => {
  const mensaje = error instanceof Error ? error.message : String(error);
  const explicacion =
    error instanceof AlmacenNoDisponible ? null : traducirErrorDeConexion(error, sslDeEntorno());
  console.error(
    explicacion ? `No se pudo conectar con la base de datos. ${explicacion}\n(${mensaje})` : mensaje,
  );
  process.exit(1);
});
