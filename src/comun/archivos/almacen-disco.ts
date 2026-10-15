import { createReadStream } from 'node:fs';
import {
  access,
  mkdir,
  rm,
  stat,
  writeFile,
  constants,
} from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import {
  AlmacenArchivos,
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
  type LecturaArchivo,
  MIME_POR_EXTENSION,
  type Rango,
} from './almacen-archivos.js';

/** Archivos en una carpeta del disco (`STORAGE_DIR`). */
export class AlmacenDisco extends AlmacenArchivos {
  readonly proveedor = 'local' as const;
  private readonly raiz: string;

  constructor(directorio: string) {
    super();
    this.raiz = resolve(directorio);
  }

  private ruta(clave: string): string {
    const ruta = resolve(this.raiz, clave);
    if (!ruta.startsWith(this.raiz + sep)) throw new ArchivoNoEncontrado(clave);
    return ruta;
  }

  async prepararse(): Promise<void> {
    try {
      await mkdir(this.raiz, { recursive: true });
      await access(this.raiz, constants.W_OK);
    } catch {
      throw new AlmacenNoDisponible(
        `No se puede escribir en la carpeta de archivos (${this.raiz}). ` +
          'Revisá STORAGE_DIR y los permisos de esa carpeta.',
      );
    }
  }

  async guardar(clave: string, contenido: Buffer): Promise<void> {
    const ruta = this.ruta(clave);
    await mkdir(dirname(ruta), { recursive: true });
    await writeFile(ruta, contenido);
  }

  async leer(clave: string, rango?: Rango): Promise<LecturaArchivo> {
    const ruta = this.ruta(clave);
    let bytesTotales: number;
    try {
      const datos = await stat(ruta);
      if (!datos.isFile()) throw new ArchivoNoEncontrado(clave);
      bytesTotales = datos.size;
    } catch {
      throw new ArchivoNoEncontrado(clave);
    }
    const extension = clave.slice(clave.lastIndexOf('.') + 1);
    return {
      flujo: createReadStream(
        ruta,
        rango ? { start: rango.inicio, end: rango.fin } : {},
      ),
      bytesTotales,
      tipoMime: MIME_POR_EXTENSION[extension] ?? 'application/octet-stream',
    };
  }

  async existe(clave: string): Promise<boolean> {
    try {
      return (await stat(this.ruta(clave))).isFile();
    } catch {
      return false;
    }
  }

  async borrar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true });
  }
}
