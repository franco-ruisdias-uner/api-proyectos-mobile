import { existsSync } from 'node:fs';

// `pnpm db:reiniciar`: borra el esquema, lo crea desde las entidades y siembra.
if (existsSync('.env')) process.loadEnvFile('.env');

if (process.env.DB_PROVEEDOR?.trim() && !process.argv.includes('--confirmar')) {
  const esquema = process.env.DB_ESQUEMA?.trim();
  console.error(
    `Estás por borrar y volver a sembrar una base en la nube (DB_PROVEEDOR=${process.env.DB_PROVEEDOR}).\n` +
      `Sólo se borra ${esquema ? `el esquema "${esquema}"` : 'lo de la API'}, pero es irreversible.\n` +
      'Si estás seguro, repetí el comando con --confirmar: pnpm db:reiniciar --confirmar',
  );
  process.exit(1);
}

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../app.module.js');
const { Sembrador } = await import('./sembrar.js');

const app = await NestFactory.createApplicationContext(
  AppModule.registrar({
    ...process.env,
    DB_BORRAR_AL_CONECTAR: 'true',
    DB_SINCRONIZAR: 'true',
    SEMBRAR_SI_VACIA: 'false',
  }),
  { logger: ['error', 'warn', 'log'] },
);
try {
  await app.get(Sembrador).sembrar();
  console.log(
    'Listo: la base quedó como recién instalada, con los datos de demo.',
  );
} finally {
  await app.close();
}
