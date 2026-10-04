// Arranque de la API. Escucha en 0.0.0.0 para que el teléfono llegue por la IP de la
// computadora (AGENTS §11.4).
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

// .env se carga antes de importar la app: las entidades leen DB_MOTOR al importarse.
if (existsSync('.env')) process.loadEnvFile('.env');

const { AppModule } = await import('./app.module.js');
const { configurarApp } = await import('./app.configurar.js');
const { Configuracion, ErrorDeConfiguracion, validarEntorno } =
  await import('./config/configuracion.js');

const logger = new Logger('API');
// Primero la configuración, para que un .env mal armado dé un mensaje claro y nada más.
try {
  validarEntorno(process.env);
} catch (error) {
  if (!(error instanceof ErrorDeConfiguracion)) throw error;
  logger.error(error.message);
  process.exit(1);
}
let app: NestExpressApplication;
try {
  app = await NestFactory.create<NestExpressApplication>(
    AppModule.registrar(),
    { abortOnError: false },
  );
} catch (error) {
  logger.error((error as Error).message);
  process.exit(1);
}
configurarApp(app);
app.enableShutdownHooks();
const config = app.get(Configuracion);
await app.listen(config.puerto, '0.0.0.0');

const direcciones = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => `http://${i!.address}:${config.puerto}`);
logger.log(
  `API lista en http://localhost:${config.puerto} (documentación en /docs)`,
);
if (existsSync('/.dockerenv')) {
  logger.log(
    'Corriendo dentro de Docker: desde el teléfono usá la IP de tu computadora ' +
      `(no la del contenedor), por ejemplo http://192.168.0.10:${config.puerto}/salud`,
  );
} else {
  for (const d of direcciones)
    logger.log(`Desde el teléfono (misma red wifi): ${d}/salud`);
}
