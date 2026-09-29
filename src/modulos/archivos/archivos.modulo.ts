import { Global, Module } from '@nestjs/common';
import { AlmacenArchivos } from '../../comun/archivos/almacen-archivos.js';
import { AlmacenDisco } from '../../comun/archivos/almacen-disco.js';
import { AlmacenS3 } from '../../comun/archivos/almacen-s3.js';
import { VerificadorArchivos } from '../../comun/archivos/verificador-archivos.js';
import { ENTORNO } from '../../config/entorno.modulo.js';
import type { Entorno } from '../../config/entorno.js';
import { ArchivosControlador } from './archivos.controlador.js';

/** Elige el adaptador según `ARCHIVOS_PROVEEDOR` y lo prepara antes de aceptar pedidos. */
export async function crearAlmacen(entorno: Entorno): Promise<AlmacenArchivos> {
  const almacen = entorno.ALMACEN_S3
    ? new AlmacenS3(entorno.ALMACEN_S3)
    : new AlmacenDisco(entorno.DIRECTORIO_ARCHIVOS);
  await almacen.prepararse();
  return almacen;
}

@Global()
@Module({
  controllers: [ArchivosControlador],
  providers: [{ provide: AlmacenArchivos, inject: [ENTORNO], useFactory: crearAlmacen }, VerificadorArchivos],
  exports: [AlmacenArchivos, VerificadorArchivos],
})
export class ArchivosModulo {}
