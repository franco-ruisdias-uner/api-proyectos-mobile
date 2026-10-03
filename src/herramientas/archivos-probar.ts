import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';
import { crearAlmacen } from '../comun/archivos/crear-almacen.js';
import { entornoDeHerramienta } from './entorno-herramienta.js';

/**
 * `pnpm archivos:probar`: con el proveedor del .env, sube un archivo chico, lo lee entero y por
 * rango, y lo borra (AGENTS §17.4). No corre en la CI: necesita cuentas reales.
 */
const entorno = entornoDeHerramienta();
const almacen = crearAlmacen(entorno);
const clave = `imagenes/prueba/${randomBytes(8).toString('hex')}.png`;
const contenido = Buffer.from(Array.from({ length: 64 }, (_, i) => i));

async function leerTodo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const p of flujo) partes.push(Buffer.from(p as Buffer));
  return Buffer.concat(partes);
}

let subido = false;
try {
  console.log(`Proveedor: ${almacen.proveedor}`);
  await almacen.prepararse();
  console.log('✓ Acceso verificado.');
  await almacen.guardar(clave, contenido, 'image/png');
  subido = true;
  console.log('✓ Subió un archivo de prueba.');
  const entero = await almacen.leer(clave);
  if (!(await leerTodo(entero.flujo)).equals(contenido))
    throw new Error('Lo leído no coincide con lo subido.');
  console.log('✓ Lo leyó entero.');
  const parte = await almacen.leer(clave, { inicio: 10, fin: 19 });
  if (
    !(await leerTodo(parte.flujo)).equals(contenido.subarray(10, 20)) ||
    parte.bytesTotales !== 64
  ) {
    throw new Error(
      'El rango (bytes 10 a 19) no devolvió lo esperado: el servicio no soporta Range.',
    );
  }
  console.log('✓ Leyó un rango.');
  await almacen.borrar(clave);
  subido = false;
  console.log('✓ Lo borró. Todo en orden.');
} catch (error) {
  console.error(`\n✗ No anduvo: ${(error as Error).message}\n`);
  if (subido) await almacen.borrar(clave).catch(() => undefined);
  process.exit(1);
}
