import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from '../app.module.js';
import { Sembrador } from './sembrar.js';

// `pnpm db:reiniciar`: borra el esquema, lo crea desde las entidades y siembra.

// Al importar AppModule, ConfigModule ya leyó el .env y lo pasó a process.env.
await ConfigModule.envVariablesLoaded;

const proveedor = process.env.DB_PROVIDER?.trim();
if (proveedor && !process.argv.includes('--confirmar')) {
  const esquema = process.env.DB_SCHEMA?.trim();
  console.error(
    `Estás por borrar y volver a sembrar una base en la nube (DB_PROVIDER=${proveedor}).\n` +
      `Sólo se borra ${esquema ? `el esquema "${esquema}"` : 'lo de la API'}, pero es irreversible.\n` +
      'Si estás seguro, repetí el comando con --confirmar: pnpm db:reiniciar --confirmar',
  );
  process.exit(1);
}

// Lo propio de este comando, por encima del .env: base desde cero y sin la siembra automática.
Object.assign(process.env, {
  DB_DROP_SCHEMA: 'true',
  DB_SYNCHRONIZE: 'true',
  SEED_IF_EMPTY: 'false',
});

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn', 'log'],
});
try {
  await app.get(Sembrador).sembrar();
  console.log(
    'Listo: la base quedó como recién instalada, con los datos de demo.',
  );
} finally {
  await app.close();
}
