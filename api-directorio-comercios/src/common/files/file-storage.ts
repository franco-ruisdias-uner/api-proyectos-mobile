import type { Readable } from 'node:stream';
import type { Salud } from '../../../contract/api.js';

export type ProveedorArchivos = Salud['almacen'];

export interface LecturaArchivo {
  flujo: Readable;
  /** Tamaño completo del archivo, aunque se haya pedido un rango. */
  bytesTotales: number;
  tipoMime: string;
}

/** Puerto de almacenamiento (AGENTS §17.1): disco o cualquier servicio compatible con S3. */
export interface AlmacenArchivos {
  readonly proveedor: ProveedorArchivos;
  /** Al arrancar: verifica el acceso (reintenta unos segundos); con emulador crea el bucket. */
  prepararse(): Promise<void>;
  guardar(clave: string, contenido: Buffer, tipoMime: string): Promise<void>;
  /** `rango` con `fin` inclusivo. Tira ArchivoNoEncontrado si la clave no existe. */
  leer(clave: string, rango?: { inicio: number; fin: number }): Promise<LecturaArchivo>;
  existe(clave: string): Promise<boolean>;
  borrar(clave: string): Promise<void>;
  /** Sólo los adaptadores de la nube: URL firmada de 15 minutos (ARCHIVOS_REDIRIGIR). */
  urlFirmada?(clave: string): Promise<string>;
}

export const ALMACEN_ARCHIVOS = Symbol('ALMACEN_ARCHIVOS');

export class ArchivoNoEncontrado extends Error {
  constructor(clave: string) {
    super(`No existe el archivo ${clave}`);
  }
}

export class AlmacenNoDisponible extends Error {}
