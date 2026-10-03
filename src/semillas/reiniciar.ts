import '../config/cargar-env.js';
import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { ALMACEN_ARCHIVOS, type AlmacenArchivos } from '../comun/archivos/almacen-archivos.js';
import { Reloj } from '../comun/reloj/reloj.js';
import { validarEntorno } from '../config/entorno.js';
import { sembrar } from './sembrar.js';

/** `pnpm db:reiniciar`: borra el esquema, lo crea desde las entidades y siembra los datos de demo. */
async function reiniciar() {
  let entorno;
  try {
    entorno = validarEntorno({
      ...process.env,
      SEMBRAR_SI_VACIA: 'false',
      DB_SINCRONIZAR: 'false',
    });
  } catch (error) {
    console.error(`\n${(error as Error).message}\n`);
    process.exit(1);
  }
  if (entorno.dbProveedor && !process.argv.includes('--confirmar')) {
    console.error(
      `\nEsto borra las tablas de la API en tu base de ${entorno.dbProveedor}` +
        `${entorno.dbEsquema ? ` (esquema «${entorno.dbEsquema}»; los demás no se tocan)` : ''} ` +
        'y las vuelve a crear con los datos de demo.\nSi estás seguro, repetí el comando con --confirmar:\n' +
        '  pnpm db:reiniciar --confirmar\n',
    );
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule.crear(entorno), {
    logger: ['error', 'warn'],
  });
  const dataSource = app.get<DataSource>(getDataSourceToken());
  console.log(
    `Base: ${entorno.dbMotor}. Borrando y creando el esquema${entorno.dbEsquema ? ` «${entorno.dbEsquema}»` : ''}…`,
  );
  await dataSource.synchronize(true);
  console.log('Cargando los datos de demo…');
  await sembrar({
    dataSource,
    reloj: app.get(Reloj),
    almacen: app.get<AlmacenArchivos>(ALMACEN_ARCHIVOS),
  });
  await app.close();
  console.log('Listo. Arrancá la API con: pnpm dev');
}

await reiniciar();
