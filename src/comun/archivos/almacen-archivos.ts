// Puerto de almacenamiento de archivos (AGENTS §17.1). El proveedor se elige por
// configuración; la app no se entera: las URLs son siempre <origen>/archivos/<clave>.
import type { Readable } from 'node:stream';
import type { ProveedorArchivos } from '../../config/configuracion.js';

export interface LecturaArchivo {
  flujo: Readable;
  /** Tamaño completo del archivo, aunque se haya pedido un rango. */
  bytesTotales: number;
  tipoMime: string;
}

export interface RangoBytes {
  inicio: number;
  /** Inclusive, como en la cabecera Range. */
  fin: number;
}

/** Token de inyección y contrato de cada adaptador. */
export abstract class AlmacenArchivos {
  abstract readonly proveedor: ProveedorArchivos;
  /** Al arrancar: verifica que se pueda leer y escribir. */
  abstract prepararse(): Promise<void>;
  abstract guardar(
    clave: string,
    contenido: Buffer,
    tipoMime: string,
  ): Promise<void>;
  abstract leer(clave: string, rango?: RangoBytes): Promise<LecturaArchivo>;
  abstract existe(clave: string): Promise<boolean>;
  abstract borrar(clave: string): Promise<void>;
}

/** La clave no existe en el almacén. */
export class ArchivoNoEncontrado extends Error {
  constructor(readonly clave: string) {
    super(`No existe el archivo ${clave}`);
  }
}

/** El proveedor no responde (red, permisos, servicio caído). */
export class AlmacenNoDisponible extends Error {}
