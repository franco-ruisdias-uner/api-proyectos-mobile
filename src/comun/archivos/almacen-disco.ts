// Adaptador de disco: los archivos quedan en DIRECTORIO_ARCHIVOS/<clave>.
import { createReadStream } from 'node:fs';
import { access, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import {
  AlmacenArchivos,
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
  type LecturaArchivo,
  type RangoBytes,
} from './almacen-archivos.js';
import { mimeDeClave } from './claves.js';
import { textoAleatorio } from '../ids/ids.js';

const esNoExiste = (e: unknown) =>
  (e as { code?: string } | null)?.code === 'ENOENT';

export class AlmacenDisco extends AlmacenArchivos {
  readonly proveedor = 'local' as const;
  private readonly raiz: string;

  constructor(directorio: string) {
    super();
    this.raiz = resolve(directorio);
  }

  /** Ruta dentro de la carpeta; una clave que intente salir de ella es un error de programación. */
  private ruta(clave: string): string {
    const ruta = resolve(this.raiz, clave);
    if (!ruta.startsWith(this.raiz + sep))
      throw new Error(`Clave inválida: ${clave}`);
    return ruta;
  }

  async prepararse(): Promise<void> {
    try {
      await mkdir(this.raiz, { recursive: true });
      await access(this.raiz);
    } catch (e) {
      throw new AlmacenNoDisponible(e);
    }
  }

  async guardar(
    clave: string,
    contenido: Buffer,
    _tipoMime: string,
  ): Promise<void> {
    const destino = this.ruta(clave);
    await mkdir(dirname(destino), { recursive: true });
    // Se escribe aparte y se renombra: nadie lee un archivo a medio escribir.
    const temporal = `${destino}.${textoAleatorio(8)}.tmp`;
    await writeFile(temporal, contenido);
    await rename(temporal, destino);
  }

  async leer(clave: string, rango?: RangoBytes): Promise<LecturaArchivo> {
    const ruta = this.ruta(clave);
    let bytesTotales: number;
    try {
      const info = await stat(ruta);
      if (!info.isFile()) throw new ArchivoNoEncontrado(clave);
      bytesTotales = info.size;
    } catch (e) {
      if (e instanceof ArchivoNoEncontrado || esNoExiste(e))
        throw new ArchivoNoEncontrado(clave);
      throw new AlmacenNoDisponible(e);
    }
    const flujo = createReadStream(
      ruta,
      rango ? { start: rango.inicio, end: rango.fin } : {},
    );
    return { flujo, bytesTotales, tipoMime: mimeDeClave(clave) };
  }

  async existe(clave: string): Promise<boolean> {
    try {
      return (await stat(this.ruta(clave))).isFile();
    } catch (e) {
      if (esNoExiste(e)) return false;
      throw new AlmacenNoDisponible(e);
    }
  }

  async borrar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true });
  }
}
