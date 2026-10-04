import type { Configuracion } from '../../config/configuracion.js';
import type { AlmacenArchivos } from './almacen-archivos.js';
import { AlmacenDisco } from './almacen-disco.js';
import { AlmacenS3 } from './almacen-s3.js';

/** El adaptador que corresponde a ARCHIVOS_PROVEEDOR (sin prepararlo). */
export function crearAlmacen(config: Configuracion): AlmacenArchivos {
  const { proveedor, s3, directorio } = config.archivos;
  return s3 ? new AlmacenS3(proveedor, s3) : new AlmacenDisco(directorio);
}
