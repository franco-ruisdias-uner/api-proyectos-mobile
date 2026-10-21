// Sube por el puerto `AlmacenArchivos` las imágenes de muestra (src/seeds/media/),
// así existen en cualquier proveedor. Las claves son fijas por espacio: sembrar de
// nuevo pisa el mismo archivo en vez de dejar basura.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AlmacenArchivos } from '../common/files/file-storage.js';
import type { EspacioSemilla } from './data/venues.js';

const IMAGENES_POR_ESPACIO = 2;

/** La carpeta cambia según se corra desde `src/` (tests, dev) o desde `dist/` (Docker). */
function carpetaDeMedios(): string {
  const candidatas = [
    resolve(process.cwd(), 'src', 'seeds', 'media'),
    resolve(import.meta.dirname, 'media'),
    resolve(import.meta.dirname, '..', '..', '..', 'src', 'seeds', 'media'),
  ];
  const encontrada = candidatas.find((c) => existsSync(c));
  if (!encontrada)
    throw new Error(
      'No se encuentra la carpeta src/seeds/media con las imágenes de muestra.',
    );
  return encontrada;
}

/** `dep-futbol5` → `soccer-5`: el nombre de los archivos de muestra. */
const ARCHIVO_POR_DEPORTE: Record<string, string> = {
  'dep-futbol5': 'soccer-5',
  'dep-futbol11': 'soccer-11',
  'dep-basquet': 'basketball',
  'dep-voley': 'volleyball',
  'dep-gimnasio': 'gym',
  'dep-tenis': 'tenis',
};

const nombreDeDeporte = (deporteId: string): string =>
  ARCHIVO_POR_DEPORTE[deporteId] ?? deporteId.replace(/^dep-/, '');

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
