import { existsSync } from 'node:fs';

// Se importa primero en main.ts y en los scripts: carga `.env` (si existe) antes de que se
// evalúen las entidades. No pisa variables que ya vengan del sistema o de Docker.
if (process.env.ENTORNO !== 'test' && existsSync('.env')) {
  process.loadEnvFile('.env');
}
