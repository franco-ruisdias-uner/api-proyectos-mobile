import '../config/load-env.js';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { traducirErrorDeConexion } from '../common/db/providers.js';
import { Sembrador } from './seed.js';

/**
 * `pnpm db:reiniciar`: borra las tablas de la API, las crea desde las entidades y siembra.
 * Contra una base en la nube (`DB_PROVEEDOR`) pide `--confirmar`, y borra sólo el esquema de la
 * API (`DB_ESQUEMA`), nunca otros: en Supabase conviven `auth`, `storage`…
 */
async function reiniciar(): Promise<void> {
  const proveedor = process.env.DB_PROVEEDOR?.trim();
  if (proveedor && !process.argv.includes('--confirmar')) {
    console.error(
      `Esto borra todos los datos de la API en tu base de ${proveedor} (sólo el esquema de la API: ` +
        `«${process.env.DB_ESQUEMA?.trim() || 'el de siempre'}») y carga los de demo.\n` +
        'Si es lo que querés, repetí el comando con --confirmar:  pnpm db:reiniciar --confirmar',
    );
    process.exit(1);
  }
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
  console.error(
    'No se pudo reiniciar la base:',
    traducirErrorDeConexion(error, undefined) ?? (error instanceof Error ? error.message : error),
  );
  process.exit(1);
});
