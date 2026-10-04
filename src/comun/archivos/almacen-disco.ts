// Adaptador de disco: los archivos van a DIRECTORIO_ARCHIVOS. El tipo MIME se
// guarda al lado, en <archivo>.tipo, para devolverlo igual que se subió.
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import {
  AlmacenArchivos,
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
  type LecturaArchivo,
  type RangoBytes,
} from './almacen-archivos.js';

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
      const prueba = join(this.raiz, '.prueba-de-escritura');
      await writeFile(prueba, 'ok');
      await rm(prueba, { force: true });
    } catch (error) {
      throw new AlmacenNoDisponible(
        `No se puede escribir en DIRECTORIO_ARCHIVOS (${this.raiz}): ${(error as Error).message}`,
      );
    }
  }

  async guardar(
    clave: string,
    contenido: Buffer,
    tipoMime: string,
  ): Promise<void> {
    const ruta = this.ruta(clave);
    await mkdir(dirname(ruta), { recursive: true });
    await writeFile(ruta, contenido);
    await writeFile(`${ruta}.tipo`, tipoMime);
  }

  async leer(clave: string, rango?: RangoBytes): Promise<LecturaArchivo> {
    const ruta = this.ruta(clave);
    let bytesTotales: number;
    let tipoMime: string;
    try {
      bytesTotales = (await stat(ruta)).size;
      tipoMime = (await readFile(`${ruta}.tipo`, 'utf8')).trim();
    } catch {
      throw new ArchivoNoEncontrado(clave);
    }
    const flujo = createReadStream(
      ruta,
      rango ? { start: rango.inicio, end: rango.fin } : {},
    );
    return { flujo, bytesTotales, tipoMime };
  }

  async existe(clave: string): Promise<boolean> {
    try {
      await access(this.ruta(clave));
      return true;
    } catch {
      return false;
    }
  }

  async borrar(clave: string): Promise<void> {
    const ruta = this.ruta(clave);
    await rm(ruta, { force: true });
    await rm(`${ruta}.tipo`, { force: true });
  }

  /** Ruta en disco, sin dejar salir de la raíz ("../" y compañía). */
  private ruta(clave: string): string {
    const ruta = resolve(this.raiz, clave);
    if (!ruta.startsWith(this.raiz + sep)) throw new ArchivoNoEncontrado(clave);
    return ruta;
  }
}
