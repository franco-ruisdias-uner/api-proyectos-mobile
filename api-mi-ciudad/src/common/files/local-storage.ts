import { createReadStream } from 'node:fs';
import { access, mkdir, rm, stat, writeFile, constants } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import {
  AlmacenArchivos,
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
  type LecturaArchivo,
  type RangoBytes,
} from './file-storage.js';
import { mimeDeClave } from './keys.js';

/** Adaptador de disco: los archivos quedan en `DIRECTORIO_ARCHIVOS`. */
export class AlmacenDisco extends AlmacenArchivos {
  readonly proveedor = 'local' as const;
  private readonly raiz: string;

  constructor(directorio: string) {
    super();
    this.raiz = resolve(directorio);
  }

  async prepararse(): Promise<void> {
    try {
      await mkdir(this.raiz, { recursive: true });
      await access(this.raiz, constants.W_OK);
    } catch (error) {
      throw new AlmacenNoDisponible(
        `No se puede escribir en la carpeta de archivos ${this.raiz}. ` +
          'Revisá DIRECTORIO_ARCHIVOS y los permisos de la carpeta.',
        { cause: error },
      );
    }
  }

  private ruta(clave: string): string {
    const ruta = resolve(join(this.raiz, clave));
    if (!ruta.startsWith(this.raiz + sep)) throw new ArchivoNoEncontrado(clave);
    return ruta;
  }

  async guardar(clave: string, contenido: Buffer): Promise<void> {
    const ruta = this.ruta(clave);
    await mkdir(dirname(ruta), { recursive: true });
    await writeFile(ruta, contenido);
  }

  async describir(clave: string): Promise<{ bytesTotales: number; tipoMime: string }> {
    try {
      const info = await stat(this.ruta(clave));
      if (!info.isFile()) throw new ArchivoNoEncontrado(clave);
      return { bytesTotales: info.size, tipoMime: mimeDeClave(clave) };
    } catch (error) {
      if (error instanceof ArchivoNoEncontrado) throw error;
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ArchivoNoEncontrado(clave);
      throw new AlmacenNoDisponible('No se pudo leer el archivo', { cause: error });
    }
  }

  async leer(clave: string, rango?: RangoBytes): Promise<LecturaArchivo> {
    const { bytesTotales, tipoMime } = await this.describir(clave);
    const flujo = createReadStream(
      this.ruta(clave),
      rango ? { start: rango.inicio, end: rango.fin } : undefined,
    );
    return { flujo, bytesTotales, tipoMime };
  }

  async existe(clave: string): Promise<boolean> {
    try {
      await this.describir(clave);
      return true;
    } catch (error) {
      if (error instanceof ArchivoNoEncontrado) return false;
      throw error;
    }
  }

  async borrar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true });
  }
}
