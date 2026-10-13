import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';

// `pnpm archivos:probar`: con la configuración del .env, sube un archivo chico al proveedor
// elegido, lo lee entero y por rango, y lo borra. Dice en castellano qué salió mal.
if (existsSync('.env')) process.loadEnvFile('.env');

const { leerEntorno } = await import('../config/entorno.js');
const { AlmacenS3 } = await import('../comun/archivos/almacen-s3.js');
const { AlmacenDisco } = await import('../comun/archivos/almacen-disco.js');

let entorno;
try {
  entorno = leerEntorno(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

async function todo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(parte as Buffer);
  return Buffer.concat(partes);
}

const almacen = entorno.ARCHIVOS_S3
  ? new AlmacenS3(entorno.ARCHIVOS_S3, 3)
  : new AlmacenDisco(entorno.DIRECTORIO_ARCHIVOS);
console.log(`Proveedor: ${almacen.proveedor}`);
const clave = `imagenes/2026/01/prueba${randomBytes(6).toString('hex')}.jpg`;
const contenido = randomBytes(2048);
try {
  await almacen.prepararse();
  console.log('✓ Acceso al bucket');
  await almacen.guardar(clave, contenido, 'image/jpeg');
  console.log('✓ Subió un archivo');
  const entero = await almacen.leer(clave);
  if (!(await todo(entero.flujo)).equals(contenido))
    throw new Error('Lo que se leyó no es igual a lo que se subió.');
  console.log('✓ Lo leyó entero');
  const rango = await almacen.leer(clave, { inicio: 10, fin: 19 });
  if (
    !(await todo(rango.flujo)).equals(contenido.subarray(10, 20)) ||
    rango.bytesTotales !== contenido.length
  )
    throw new Error(
      'La lectura por rango (bytes 10 a 19) no devolvió lo esperado.',
    );
  console.log('✓ Lo leyó por rango');
  await almacen.borrar(clave);
  if (await almacen.existe(clave))
    throw new Error('Después de borrar, el archivo sigue existiendo.');
  console.log('✓ Lo borró. Los archivos están listos.');
} catch (error) {
  console.error(`✗ ${(error as Error).message}`);
  await almacen.borrar(clave).catch(() => undefined);
  process.exit(1);
}
