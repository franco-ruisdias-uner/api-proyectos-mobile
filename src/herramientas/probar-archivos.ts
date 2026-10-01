// pnpm archivos:probar — con la configuración del .env, sube un archivo chico al proveedor,
// lo lee entero y por rango, y lo borra. Dice en castellano qué salió mal (AGENTS §17.4).
// No corre en la CI: necesita cuentas reales.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import type { Readable } from 'node:stream';
import { AlmacenLocal } from '../comun/archivos/almacen-local.js';
import { AlmacenS3 } from '../comun/archivos/almacen-s3.js';
import type { AlmacenArchivos } from '../comun/archivos/almacen-archivos.js';
import { ErrorDeConfiguracion, leerConfiguracion } from '../config/configuracion.js';

async function leerTodo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(Buffer.from(parte as Uint8Array));
  return Buffer.concat(partes);
}

async function probar(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  let almacen: AlmacenArchivos;
  try {
    const { archivos } = leerConfiguracion(process.env);
    almacen = archivos.s3 ? new AlmacenS3(archivos.s3, 2) : new AlmacenLocal(archivos.directorio);
  } catch (error) {
    if (error instanceof ErrorDeConfiguracion) {
      console.error(`\n${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  console.log(`Proveedor de archivos: ${almacen.proveedor}`);
  const clave = `imagenes/prueba/${randomBytes(6).toString('hex')}.jpg`;
  const contenido = randomBytes(200);
  let paso = 'conectar';
  try {
    await almacen.prepararse();
    console.log('✓ Se puede acceder al almacén.');
    paso = 'subir';
    await almacen.guardar(clave, contenido, 'image/jpeg');
    console.log('✓ Subió un archivo de prueba.');
    paso = 'leer';
    const entero = await almacen.leer(clave);
    if (!(await leerTodo(entero.flujo)).equals(contenido))
      throw new Error('El archivo volvió distinto.');
    console.log('✓ Lo leyó entero, con los mismos bytes.');
    paso = 'leer un rango';
    const parte = await almacen.leer(clave, { inicio: 10, fin: 19 });
    if (!(await leerTodo(parte.flujo)).equals(contenido.subarray(10, 20))) {
      throw new Error('El rango volvió distinto.');
    }
    console.log('✓ Leyó un rango (bytes 10 a 19).');
    paso = 'borrar';
    await almacen.borrar(clave);
    if (await almacen.existe(clave))
      throw new Error('El archivo sigue estando después de borrarlo.');
    console.log('✓ Lo borró.');
    console.log('\nTodo bien: los archivos están listos.');
  } catch (error) {
    const causa = (error as { cause?: unknown }).cause ?? error;
    const detalle = causa instanceof Error ? `${causa.name}: ${causa.message}` : String(causa);
    console.error(
      `\n✗ Falló al ${paso}.\n${(error as Error).message}\nDetalle técnico: ${detalle}\n`,
    );
    await almacen.borrar(clave).catch(() => undefined);
    process.exit(1);
  }
}

await probar();
