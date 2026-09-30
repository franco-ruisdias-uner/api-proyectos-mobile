// pnpm archivos:probar — con la configuración del .env, sube un archivo chico, lo lee entero
// y por rango, y lo borra. Dice en castellano qué salió mal (AGENTS §17.4).
import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import type { Readable } from 'node:stream';

if (existsSync('.env')) process.loadEnvFile('.env');

const { crearAlmacen } = await import('../comun/archivos/archivos.modulo.js');
const { AlmacenNoDisponible } =
  await import('../comun/archivos/almacen-archivos.js');
const { ErrorDeConfiguracion, validarEntorno } =
  await import('../config/entorno.js');

async function leerTodo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(Buffer.from(parte as Buffer));
  return Buffer.concat(partes);
}

function explicar(e: unknown): string {
  const causa = e instanceof AlmacenNoDisponible ? e.cause : e;
  const nombre = (causa as { name?: string } | null)?.name ?? '';
  const mensaje = (causa as Error | null)?.message ?? String(causa);
  if (
    /InvalidAccessKeyId|SignatureDoesNotMatch|AccessDenied|Forbidden/i.test(
      nombre + mensaje,
    )
  )
    return `Las credenciales no son correctas o no tienen permiso (${nombre}). Revisá S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY.`;
  if (/NoSuchBucket/i.test(nombre + mensaje))
    return 'El bucket no existe. Revisá S3_BUCKET (o creálo en el panel del proveedor).';
  if (
    /region/i.test(mensaje) ||
    /PermanentRedirect|AuthorizationHeaderMalformed/i.test(nombre)
  )
    return `La región parece equivocada. Revisá S3_REGION (${mensaje}).`;
  if (/ENOTFOUND|ECONNREFUSED|EAI_AGAIN|fetch failed/i.test(nombre + mensaje))
    return `No se pudo llegar al servidor (${mensaje}). Revisá el proveedor, S3_ENDPOINT y tu conexión.`;
  return mensaje;
}

try {
  const entorno = validarEntorno(process.env);
  const almacen = crearAlmacen(entorno);
  console.log(`Proveedor: ${almacen.proveedor}`);
  const clave = `imagenes/2000/01/prueba-${randomBytes(6).toString('hex')}.jpg`;
  const contenido = Buffer.from(Array.from({ length: 200 }, (_, i) => i % 251));

  await almacen.prepararse();
  console.log('✓ Acceso al almacén');
  await almacen.guardar(clave, contenido, 'image/jpeg');
  console.log('✓ Subir un archivo');
  const entero = await almacen.leer(clave);
  if (Buffer.compare(await leerTodo(entero.flujo), contenido) !== 0)
    throw new Error('El archivo que se bajó no es igual al que se subió.');
  console.log('✓ Leerlo entero');
  const rango = await almacen.leer(clave, { inicio: 10, fin: 19 });
  if (
    Buffer.compare(await leerTodo(rango.flujo), contenido.subarray(10, 20)) !==
      0 ||
    rango.bytesTotales !== 200
  )
    throw new Error('El rango pedido no devolvió los bytes esperados.');
  console.log('✓ Leerlo por rango');
  await almacen.borrar(clave);
  if (await almacen.existe(clave))
    throw new Error('No se pudo borrar el archivo de prueba.');
  console.log('✓ Borrarlo');
  console.log('\nTodo bien: el almacén de archivos está bien configurado.');
} catch (e) {
  console.error(
    e instanceof ErrorDeConfiguracion
      ? `\n${e.message}\n`
      : `\n✗ ${explicar(e)}\n`,
  );
  process.exit(1);
}
