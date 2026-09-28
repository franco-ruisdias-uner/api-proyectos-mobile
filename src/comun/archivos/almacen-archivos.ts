import type { Readable } from 'node:stream';
import type { Salud } from '../../../contrato/api.js';

export type ProveedorArchivos = Salud['almacen'];

export interface LecturaArchivo {
  flujo: Readable;
  /** Tamaño completo del archivo, aunque se haya pedido un rango. */
  bytesTotales: number;
  tipoMime: string;
}

export interface RangoBytes {
  inicio: number;
  fin: number;
}

/**
 * Puerto de almacenamiento de archivos (AGENTS §17.1). Cambiar de proveedor es cambiar la
 * configuración: la API sirve siempre los archivos en `/archivos/<clave>`.
 */
export abstract class AlmacenArchivos {
  abstract readonly proveedor: ProveedorArchivos;
  /** Al arrancar: verifica que se puede escribir (y crea lo que haga falta). */
  abstract prepararse(): Promise<void>;
  abstract guardar(clave: string, contenido: Buffer, tipoMime: string): Promise<void>;
  /** Tira `ArchivoNoEncontrado` si la clave no existe. */
  abstract leer(clave: string, rango?: RangoBytes): Promise<LecturaArchivo>;
  /** Tamaño y tipo, sin abrir el contenido. Tira `ArchivoNoEncontrado`. */
  abstract describir(clave: string): Promise<{ bytesTotales: number; tipoMime: string }>;
  abstract existe(clave: string): Promise<boolean>;
  abstract borrar(clave: string): Promise<void>;
}

export class ArchivoNoEncontrado extends Error {
  constructor(clave: string) {
    super(`No existe el archivo ${clave}`);
  }
}

export class AlmacenNoDisponible extends Error {}
