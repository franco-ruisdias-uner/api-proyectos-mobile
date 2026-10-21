// Puerto de almacenamiento de archivos (AGENTS §17.1). Hay un adaptador por tipo de servicio
// (disco; S3 en el módulo «Nube»), y el controlador de /archivos es el mismo para todos.
import type { Readable } from 'node:stream';
import type { ProveedorArchivos } from '../../config/environment.js';

export interface LecturaArchivo {
  flujo: Readable;
  /** Tamaño completo del archivo, aunque se haya pedido un rango. */
  bytesTotales: number;
  tipoMime: string;
}

export interface RangoBytes {
  inicio: number;
  fin: number; // inclusive
}

/** Clase abstracta para usarla como token de Nest. */
export abstract class AlmacenArchivos {
  /** Lo que informa /salud en `almacen`. */
  abstract readonly proveedor: ProveedorArchivos;
  /** Al arrancar: verifica el acceso (y con un emulador, crea el bucket). */
  abstract prepararse(): Promise<void>;
  abstract guardar(
    clave: string,
    contenido: Buffer,
    tipoMime: string,
  ): Promise<void>;
  abstract leer(clave: string, rango?: RangoBytes): Promise<LecturaArchivo>;
  abstract existe(clave: string): Promise<boolean>;
  abstract borrar(clave: string): Promise<void>;
  /** Sólo proveedores en la nube: URL firmada de lectura (ARCHIVOS_REDIRIGIR). */
  urlFirmada?(clave: string, segundos: number): Promise<string>;
}

/** La clave no existe en el almacén: 404 ARCHIVO_NO_ENCONTRADO. */
export class ArchivoNoEncontrado extends Error {
  constructor(readonly clave: string) {
    super(`No existe el archivo ${clave}`);
    this.name = 'ArchivoNoEncontrado';
  }
}

/** El proveedor no responde: 503 ALMACEN_NO_DISPONIBLE. */
export class AlmacenNoDisponible extends Error {
  constructor(causa: unknown) {
    super('El almacén de archivos no responde', { cause: causa });
    this.name = 'AlmacenNoDisponible';
  }
}
