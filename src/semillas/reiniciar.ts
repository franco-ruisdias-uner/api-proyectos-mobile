import '../config/cargar-env.js';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { Sembrador } from './sembrador.js';

/** `pnpm db:reiniciar`: borra el esquema, lo crea desde las entidades y siembra. */
async function reiniciar(): Promise<void> {
  const app = await NestFactory.createApplicationContext(
    AppModule.registrar({ DB_SINCRONIZAR: 'false', SEMBRAR_SI_VACIA: 'false' }),
    { logger: ['error', 'warn', 'log'] },
  );
  try {
    const dataSource = app.get(DataSource);
    await dataSource.synchronize(true);
    await app.get(Sembrador).sembrar();
    console.log('Listo: la base quedó como nueva, con los datos de demo.');
  } finally {
    await app.close();
  }
}

reiniciar().catch((error: unknown) => {
  console.error('No se pudo reiniciar la base:', error instanceof Error ? error.message : error);
  process.exit(1);
});
