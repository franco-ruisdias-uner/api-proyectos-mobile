import { createReadStream } from 'node:fs';
import { access, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import {
  type AlmacenArchivos,
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
  type LecturaArchivo,
} from './almacen-archivos.js';
import { mimeDeExtension } from './reglas/tipos-archivo.js';

/** Archivos en una carpeta del disco (`DIRECTORIO_ARCHIVOS`). */
export class AlmacenLocal implements AlmacenArchivos {
  readonly proveedor = 'local' as const;
  private readonly raiz: string;

  constructor(directorio: string) {
    this.raiz = resolve(directorio);
  }

  async prepararse(): Promise<void> {
    try {
      await mkdir(this.raiz, { recursive: true });
      await access(this.raiz);
    } catch (error) {
      throw new Error(
        `No se puede usar la carpeta de archivos "${this.raiz}" (DIRECTORIO_ARCHIVOS): ${(error as Error).message}`,
      );
    }
  }

  async guardar(clave: string, contenido: Buffer): Promise<void> {
    const ruta = this.ruta(clave);
    try {
      await mkdir(dirname(ruta), { recursive: true });
      await writeFile(ruta, contenido);
    } catch (error) {
      throw new AlmacenNoDisponible((error as Error).message);
    }
  }

  async leer(clave: string, rango?: { inicio: number; fin: number }): Promise<LecturaArchivo> {
    const ruta = this.ruta(clave);
    const info = await stat(ruta).catch(() => null);
    if (!info?.isFile()) throw new ArchivoNoEncontrado(clave);
    const ext = clave.slice(clave.lastIndexOf('.') + 1);
    return {
      flujo: createReadStream(ruta, rango ? { start: rango.inicio, end: rango.fin } : {}),
      bytesTotales: info.size,
      tipoMime: mimeDeExtension(ext),
    };
  }

  async existe(clave: string): Promise<boolean> {
    const info = await stat(this.ruta(clave)).catch(() => null);
    return info?.isFile() ?? false;
  }

  async borrar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true });
  }

  /** Nunca sale de la carpeta raíz, aunque la clave traiga `..`. */
  private ruta(clave: string): string {
    const ruta = resolve(this.raiz, clave);
    if (!ruta.startsWith(this.raiz + sep)) throw new ArchivoNoEncontrado(clave);
    return ruta;
  }
}
