import '../config/load-env.js';
import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';
import { crearAlmacen } from '../modules/files/files.module.js';
import { validarEntorno, type Entorno } from '../config/environment.js';

async function leerTodo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(Buffer.from(parte as Buffer));
  return Buffer.concat(partes);
}

function falla(mensaje: string): never {
  throw new Error(mensaje);
}

/**
 * `pnpm archivos:probar` (AGENTS §17.4): con la configuración del `.env`, sube un archivo chico,
 * lo lee entero y por rango, y lo borra. Sirve contra cualquier proveedor. No corre en la CI.
 */
async function probar(): Promise<void> {
  let entorno: Entorno;
  try {
    entorno = validarEntorno(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  console.log(`Probando los archivos (${entorno.ARCHIVOS_PROVEEDOR})…`);
  const clave = `imagenes/2000/01/prueba-${randomBytes(6).toString('hex')}.png`;
  const contenido = Buffer.from(Array.from({ length: 100 }, (_, i) => i));
  try {
    const almacen = await crearAlmacen(entorno);
    console.log('  ✓ Conexión y bucket.');
    await almacen.guardar(clave, contenido, 'image/png');
    console.log('  ✓ Se pudo subir un archivo.');
    const entero = await almacen.leer(clave);
    if (Buffer.compare(await leerTodo(entero.flujo), contenido) !== 0)
      falla('el archivo que volvió no es igual al que se subió');
    console.log('  ✓ Se pudo leer entero, con los mismos bytes.');
    const parte = await almacen.leer(clave, { inicio: 10, fin: 19 });
    const bytes = await leerTodo(parte.flujo);
    if (bytes.length !== 10 || bytes[0] !== 10)
      falla(
        'el servicio no respetó el pedido de un rango de bytes (sin eso, las audioguías no se pueden adelantar)',
      );
    console.log('  ✓ Se pudo leer un rango de bytes.');
    await almacen.borrar(clave);
    if (await almacen.existe(clave)) falla('el archivo de prueba no se borró');
    console.log('  ✓ Se pudo borrar.');
    (almacen as { cerrar?: () => void }).cerrar?.();
    console.log('\nTodo bien: los archivos están listos para la API.');
  } catch (error) {
    console.error(`\n  ✗ ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

void probar();
