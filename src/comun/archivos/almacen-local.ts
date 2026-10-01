import { constants, createReadStream } from 'node:fs';
import { access, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import {
  type AlmacenArchivos,
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
  type LecturaArchivo,
} from './almacen-archivos.js';
import { MIME_POR_EXTENSION } from './firma.js';
import type { Rango } from './rango.js';

const esNoEncontrado = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';

/** Adaptador de disco: guarda cada clave como un archivo dentro de DIRECTORIO_ARCHIVOS. */
export class AlmacenLocal implements AlmacenArchivos {
  readonly proveedor = 'local' as const;
  private readonly raiz: string;

  constructor(directorio: string) {
    this.raiz = resolve(directorio);
  }

  async prepararse(): Promise<void> {
    try {
      await mkdir(this.raiz, { recursive: true });
      await access(this.raiz, constants.W_OK);
    } catch (error) {
      throw new Error(
        `No se puede usar la carpeta de archivos "${this.raiz}". Revisá DIRECTORIO_ARCHIVOS en ` +
          'el .env: tiene que ser una carpeta en la que la API pueda escribir.',
        { cause: error },
      );
    }
  }

  private ruta(clave: string): string {
    const ruta = resolve(this.raiz, clave);
    if (!ruta.startsWith(this.raiz + sep)) throw new ArchivoNoEncontrado(clave);
    return ruta;
  }

  async guardar(clave: string, contenido: Buffer): Promise<void> {
    const ruta = this.ruta(clave);
    try {
      await mkdir(dirname(ruta), { recursive: true });
      await writeFile(ruta, contenido);
    } catch (error) {
      throw new AlmacenNoDisponible(error);
    }
  }

  async leer(clave: string, rango?: Rango): Promise<LecturaArchivo> {
    const ruta = this.ruta(clave);
    let bytesTotales: number;
    try {
      const datos = await stat(ruta);
      if (!datos.isFile()) throw new ArchivoNoEncontrado(clave);
      bytesTotales = datos.size;
    } catch (error) {
      if (error instanceof ArchivoNoEncontrado || esNoEncontrado(error)) {
        throw new ArchivoNoEncontrado(clave);
      }
      throw new AlmacenNoDisponible(error);
    }
    const flujo = createReadStream(ruta, rango ? { start: rango.inicio, end: rango.fin } : {});
    const tipoMime =
      MIME_POR_EXTENSION[extname(clave).slice(1).toLowerCase()] ?? 'application/octet-stream';
    return { flujo, bytesTotales, tipoMime };
  }

  async existe(clave: string): Promise<boolean> {
    try {
      return (await stat(this.ruta(clave))).isFile();
    } catch (error) {
      if (error instanceof ArchivoNoEncontrado || esNoEncontrado(error)) return false;
      throw new AlmacenNoDisponible(error);
    }
  }

  async borrar(clave: string): Promise<void> {
    try {
      await rm(this.ruta(clave), { force: true });
    } catch (error) {
      throw new AlmacenNoDisponible(error);
    }
  }
}
