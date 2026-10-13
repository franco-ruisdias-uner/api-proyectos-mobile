import type { Readable } from 'node:stream';
import type { ProveedorArchivos } from '../../config/entorno.js';

// El puerto de archivos (AGENTS §17.1). Cambiar de proveedor es cambiar la configuración:
// las URLs que ve la app son siempre <origen>/archivos/<clave>.

export interface LecturaArchivo {
  flujo: Readable;
  /** Tamaño completo del archivo (no del rango). */
  bytesTotales: number;
  tipoMime: string;
}

export interface Rango {
  inicio: number;
  /** Inclusive. */
  fin: number;
}

export abstract class AlmacenArchivos {
  abstract readonly proveedor: ProveedorArchivos;
  /** Al arrancar: verifica que se pueda escribir. */
  abstract prepararse(): Promise<void>;
  abstract guardar(
    clave: string,
    contenido: Buffer,
    tipoMime: string,
  ): Promise<void>;
  abstract leer(clave: string, rango?: Rango): Promise<LecturaArchivo>;
  abstract existe(clave: string): Promise<boolean>;
  abstract borrar(clave: string): Promise<void>;
  /** Sólo proveedores en la nube: URL firmada de lectura (ARCHIVOS_REDIRIGIR). */
  urlFirmada?(clave: string, segundos: number): Promise<string>;
}

export class ArchivoNoEncontrado extends Error {
  constructor(readonly clave: string) {
    super(`No existe el archivo ${clave}`);
  }
}

export class AlmacenNoDisponible extends Error {}

const CLAVE_VALIDA =
  /^(imagenes|audios|videos)\/\d{4}\/\d{2}\/[a-z0-9]{8,40}\.(jpg|png|webp|m4a|aac|mp3|mp4)$/;

/** Clave de la forma imagenes/AAAA/MM/<id>.<ext> (sin "..", sin barras raras). */
export function esClaveValida(clave: string): boolean {
  return CLAVE_VALIDA.test(clave);
}

export const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};
