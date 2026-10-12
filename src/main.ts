import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

// El .env se carga antes de importar la app: las entidades leen DB_MOTOR al cargarse.
if (existsSync('.env')) process.loadEnvFile('.env');

const { NestFactory } = await import('@nestjs/core');
const { Logger } = await import('@nestjs/common');
const { AppModule } = await import('./app.module.js');
const { configurarApp } = await import('./arranque.js');
const { leerEntorno } = await import('./config/entorno.js');

let entorno;
try {
  entorno = leerEntorno(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const app = await NestFactory.create<
  import('@nestjs/platform-express').NestExpressApplication
>(AppModule.registrar(process.env));
configurarApp(app, entorno);
app.enableShutdownHooks();
await app.listen(entorno.PUERTO, '0.0.0.0');

const log = new Logger('Arranque');
const enDocker = existsSync('/.dockerenv');
log.log(
  `API escuchando en el puerto ${entorno.PUERTO} (base: ${entorno.DB_MOTOR}).`,
);
if (enDocker) {
  log.log(
    `Estás en Docker: desde el teléfono usá la IP de tu computadora, por ejemplo http://192.168.0.10:${entorno.PUERTO}`,
  );
} else {
  for (const lista of Object.values(networkInterfaces())) {
    for (const red of lista ?? []) {
      if (red.family === 'IPv4' && !red.internal) {
        log.log(
          `Desde el teléfono (misma red wifi): http://${red.address}:${entorno.PUERTO}/salud`,
        );
      }
    }
  }
}
log.log(`En esta computadora: http://localhost:${entorno.PUERTO}/docs`);
