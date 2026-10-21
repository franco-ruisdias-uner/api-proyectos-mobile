import { Global, Module } from '@nestjs/common';
import { AlmacenArchivos } from '../../common/files/file-storage.js';
import { AlmacenDisco } from '../../common/files/local-storage.js';
import { AlmacenS3 } from '../../common/files/s3-storage.js';
import { VerificadorArchivos } from '../../common/files/file-verifier.js';
import { ENTORNO } from '../../config/environment.module.js';
import type { Entorno } from '../../config/environment.js';
import { ArchivosControlador } from './files.controller.js';

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
