import { Global, Module } from '@nestjs/common';
import { CONFIGURACION, type Configuracion } from '../../config/configuracion.js';
import { ALMACEN_ARCHIVOS, type AlmacenArchivos } from './almacen-archivos.js';
import { AlmacenLocal } from './almacen-local.js';
import { AlmacenS3 } from './almacen-s3.js';
import { ArchivosControlador } from './archivos.controlador.js';
import { ArchivosServicio } from './archivos.servicio.js';

@Global()
@Module({
  controllers: [ArchivosControlador],
  providers: [
    {
      provide: ALMACEN_ARCHIVOS,
      inject: [CONFIGURACION],
      // Dos adaptadores: disco y S3 (con un preset por proveedor, AGENTS §17.2).
      useFactory: (config: Configuracion): AlmacenArchivos =>
        config.archivos.s3
          ? new AlmacenS3(config.archivos.s3)
          : new AlmacenLocal(config.archivos.directorio),
    },
    ArchivosServicio,
  ],
  exports: [ArchivosServicio],
})
export class ArchivosModulo {}
