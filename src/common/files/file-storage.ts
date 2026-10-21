import type { Readable } from 'node:stream';
import type { ProveedorArchivos } from '../../config/environment.js';
import type { Rango } from './range.js';

export interface LecturaArchivo {
  flujo: Readable;
  bytesTotales: number; // tamaño completo del archivo
  tipoMime: string;
}

/** Puerto de almacenamiento de archivos (AGENTS §17.1). Un adaptador por tecnología. */
export interface AlmacenArchivos {
  readonly proveedor: ProveedorArchivos;
  prepararse(): Promise<void>;
  guardar(clave: string, contenido: Buffer, tipoMime: string): Promise<void>;
  leer(clave: string, rango?: Rango): Promise<LecturaArchivo>;
  existe(clave: string): Promise<boolean>;
  borrar(clave: string): Promise<void>;
  /** Sólo los adaptadores de nube: URL firmada de 15 minutos (ARCHIVOS_REDIRIGIR). */
  urlFirmada?(clave: string): Promise<string>;
}

export const ALMACEN_ARCHIVOS = Symbol('ALMACEN_ARCHIVOS');

/** La clave no existe en el almacén. */
export class ArchivoNoEncontrado extends Error {
  constructor(readonly clave: string) {
    super(`No existe el archivo ${clave}`);
    this.name = 'ArchivoNoEncontrado';
  }
}

/** El proveedor no responde (disco sin permisos, servicio caído). */
export class AlmacenNoDisponible extends Error {
  constructor(causa: unknown) {
    super('El almacén de archivos no responde', { cause: causa });
    this.name = 'AlmacenNoDisponible';
  }
}
