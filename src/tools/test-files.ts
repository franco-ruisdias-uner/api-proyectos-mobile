import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';
import { AlmacenDisco } from '../common/files/local-storage.js';
import { AlmacenS3 } from '../common/files/s3-storage.js';
import {
  buildConfiguration,
  type Configuration,
} from '../config/configuration.js';

// `pnpm archivos:probar`: con la configuración del .env, sube un archivo chico al proveedor
// elegido, lo lee entero y por rango, y lo borra. Dice en castellano qué salió mal.
// El .env lo carga Node (`--env-file-if-exists=.env` en el script de package.json).

let config: Configuration;
try {
  config = buildConfiguration(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

async function todo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(parte as Buffer);
  return Buffer.concat(partes);
}

const almacen = config.storage.s3
  ? new AlmacenS3(config.storage.s3, 3)
  : new AlmacenDisco(config.storage.dir);
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
