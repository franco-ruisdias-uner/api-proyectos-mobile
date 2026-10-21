import { existsSync } from 'node:fs';

/**
 * Carga `.env` antes que cualquier otro import: los helpers de columnas leen DB_MOTOR al
 * cargar las entidades. Se importa primero en main.ts y en los scripts. Lo que ya está en el
 * entorno (Docker, CI, la terminal) gana sobre el archivo.
 */
if (existsSync('.env')) process.loadEnvFile('.env');
