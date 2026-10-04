// Sube por el puerto `AlmacenArchivos` las imágenes de muestra (src/semillas/medios/),
// así existen en cualquier proveedor. Las claves son fijas por espacio: sembrar de
// nuevo pisa el mismo archivo en vez de dejar basura.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AlmacenArchivos } from '../comun/archivos/almacen-archivos.js';
import type { EspacioSemilla } from './datos/espacios.js';

const IMAGENES_POR_ESPACIO = 2;

/** La carpeta cambia según se corra desde `src/` (tests, dev) o desde `dist/` (Docker). */
function carpetaDeMedios(): string {
  const candidatas = [
    resolve(process.cwd(), 'src', 'semillas', 'medios'),
    resolve(import.meta.dirname, 'medios'),
    resolve(import.meta.dirname, '..', '..', '..', 'src', 'semillas', 'medios'),
  ];
  const encontrada = candidatas.find((c) => existsSync(c));
  if (!encontrada)
    throw new Error(
      'No se encuentra la carpeta src/semillas/medios con las imágenes de muestra.',
    );
  return encontrada;
}

/** `dep-futbol5` → `futbol5`: el nombre de los archivos de muestra. */
const nombreDeDeporte = (deporteId: string): string =>
  deporteId.replace(/^dep-/, '');

/** Sube las imágenes de cada espacio y devuelve sus claves, por id de espacio. */
export async function subirMedios(
  almacen: AlmacenArchivos,
  espacios: EspacioSemilla[],
  anio: string,
  mes: string,
): Promise<Map<string, string[]>> {
  const carpeta = carpetaDeMedios();
  const claves = new Map<string, string[]>();
  for (const e of espacios) {
    const deEste: string[] = [];
    for (let n = 1; n <= IMAGENES_POR_ESPACIO; n++) {
      const contenido = await readFile(
        join(carpeta, `${nombreDeDeporte(e.deporteId)}-${n}.png`),
      );
      const clave = `imagenes/${anio}/${mes}/semilla-${e.id}-${n}.png`;
      await almacen.guardar(clave, contenido, 'image/png');
      deEste.push(clave);
    }
    claves.set(e.id, deEste);
  }
  return claves;
}
