import type { Entorno } from '../../config/environment.js';
import type { AlmacenArchivos } from './file-storage.js';
import { AlmacenLocal } from './local-storage.js';
import { AlmacenS3 } from './s3-storage.js';

/** El adaptador que corresponde a `ARCHIVOS_PROVEEDOR`. Todavía no se preparó (`prepararse`). */
export function crearAlmacen(entorno: Entorno): AlmacenArchivos {
  return entorno.s3
    ? new AlmacenS3(entorno.s3, entorno.entorno === 'test' ? 1 : 5)
    : new AlmacenLocal(entorno.directorioArchivos);
}
