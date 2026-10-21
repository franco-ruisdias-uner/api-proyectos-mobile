// Arranque de la API. Carga el .env ANTES de importar la app: los tipos de columna de las
// entidades dependen de DB_MOTOR y se fijan al importarlas.
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { Logger } from '@nestjs/common';

if (existsSync('.env')) process.loadEnvFile('.env');

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('./app.module.js');
const { configurarAplicacion, OPCIONES_NEST } = await import('./setup-app.js');
const { ENTORNO } = await import('./config/environment.module.js');
const { ErrorDeConfiguracion, validarEntorno } =
  await import('./config/environment.js');
type NestExpressApplication =
  import('@nestjs/platform-express').NestExpressApplication;
type Entorno = import('./config/environment.js').Entorno;

const logger = new Logger('Arranque');

function direccionesDeRed(puerto: number): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i!.address}:${puerto}`);
}

async function arrancar(): Promise<void> {
  // Antes de Nest, para que un .env incompleto se explique sin un stack trace de por medio.
  validarEntorno(process.env);
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.registrar(),
    OPCIONES_NEST,
  );
  configurarAplicacion(app);
  app.enableShutdownHooks();
  const entorno = app.get<Entorno>(ENTORNO);
  await app.listen(entorno.PUERTO, '0.0.0.0');

  const enDocker = existsSync('/.dockerenv');
  logger.log(
    `API lista · motor ${entorno.DB_MOTOR} · archivos ${entorno.ARCHIVOS_PROVEEDOR}`,
  );
  logger.log(`En esta computadora: http://localhost:${entorno.PUERTO}/salud`);
  if (enDocker) {
    logger.log(
      'Estás en Docker: desde el teléfono usá la IP de tu computadora (no la del contenedor), por ejemplo http://192.168.0.10:3000/salud',
    );
  } else {
    for (const url of direccionesDeRed(entorno.PUERTO))
      logger.log(`Desde el teléfono (misma red): ${url}/salud`);
  }
  logger.log(`Documentación: http://localhost:${entorno.PUERTO}/docs`);
  if (entorno.RELOJ_FIJO)
    logger.warn(
      `Reloj congelado en ${entorno.RELOJ_FIJO.toISOString()} (RELOJ_FIJO)`,
    );
}

try {
  await arrancar();
} catch (error) {
  if (error instanceof ErrorDeConfiguracion) {
    console.error(`\n${error.message}\n`);
  } else {
    logger.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
  }
  process.exit(1);
}
