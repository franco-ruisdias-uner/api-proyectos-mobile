// `pnpm archivos:probar`: con la configuración del .env, sube un archivo chico, lo lee
// entero y por rango, y lo borra. Dice en castellano qué salió mal (AGENTS §17.4).
import { existsSync } from 'node:fs';
import type { Readable } from 'node:stream';

if (existsSync('.env')) process.loadEnvFile('.env');

const { validarEntorno, ErrorDeConfiguracion } =
  await import('../config/environment.js');
const { textoAleatorio } = await import('../common/ids/ids.js');
const { crearAlmacen } = await import('../common/files/create-storage.js');

async function leerTodo(flujo: Readable): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(Buffer.from(parte as Buffer));
  return Buffer.concat(partes);
}

function paso(texto: string): void {
  console.log(`  ✓ ${texto}`);
}

try {
  const config = validarEntorno(process.env);
  const almacen = crearAlmacen(config);
  console.log(`Probando el almacén de archivos «${almacen.proveedor}»…`);
  await almacen.prepararse();
  paso('acceso al bucket / carpeta');

  const clave = `imagenes/0000/00/prueba-${textoAleatorio(10)}.png`;
  const contenido = Buffer.from(Array.from({ length: 64 }, (_, i) => i));
  await almacen.guardar(clave, contenido, 'image/png');
  paso('subida');
  const entero = await almacen.leer(clave);
  if (!(await leerTodo(entero.flujo)).equals(contenido))
    throw new Error('El archivo que se bajó no es igual al que se subió.');
  paso(`lectura completa (${entero.bytesTotales} bytes, ${entero.tipoMime})`);
  const rango = await almacen.leer(clave, { inicio: 10, fin: 19 });
  if (!(await leerTodo(rango.flujo)).equals(contenido.subarray(10, 20)))
    throw new Error(
      'La lectura por rango (bytes 10 a 19) devolvió otros bytes.',
    );
  paso('lectura por rango');
  await almacen.borrar(clave);
  if (await almacen.existe(clave))
    throw new Error('El archivo de prueba no se pudo borrar.');
  paso('borrado');
  console.log('Todo bien: el proveedor de archivos está bien configurado.');
} catch (error) {
  if (error instanceof ErrorDeConfiguracion) console.error(error.message);
  else
    console.error(
      `No anduvo: ${(error as Error).message}\n` +
        'Revisá las credenciales (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY), el nombre del bucket (S3_BUCKET) y la región (S3_REGION).',
    );
  process.exit(1);
}
