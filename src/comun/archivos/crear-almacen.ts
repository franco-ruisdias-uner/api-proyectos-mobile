import type { Entorno } from '../../config/entorno.js';
import type { AlmacenArchivos } from './almacen-archivos.js';
import { AlmacenLocal } from './almacen-local.js';
import { AlmacenS3 } from './almacen-s3.js';

/** El adaptador que corresponde a `ARCHIVOS_PROVEEDOR`. Todavía no se preparó (`prepararse`). */
export function crearAlmacen(entorno: Entorno): AlmacenArchivos {
  return entorno.s3
    ? new AlmacenS3(entorno.s3, entorno.entorno === 'test' ? 1 : 5)
    : new AlmacenLocal(entorno.directorioArchivos);
}
