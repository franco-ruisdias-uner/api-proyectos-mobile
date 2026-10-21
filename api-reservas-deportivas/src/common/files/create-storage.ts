import type { Configuracion } from '../../config/environment.js';
import type { AlmacenArchivos } from './file-storage.js';
import { AlmacenDisco } from './local-storage.js';
import { AlmacenS3 } from './s3-storage.js';

/** El adaptador que corresponde a ARCHIVOS_PROVEEDOR (sin prepararlo). */
export function crearAlmacen(config: Configuracion): AlmacenArchivos {
  const { proveedor, s3, directorio } = config.archivos;
  return s3 ? new AlmacenS3(proveedor, s3) : new AlmacenDisco(directorio);
}
