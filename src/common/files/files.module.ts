import { Global, Module } from '@nestjs/common';
import { CONFIGURACION, type Configuracion } from '../../config/environment.js';
import { ALMACEN_ARCHIVOS, type AlmacenArchivos } from './file-storage.js';
import { AlmacenLocal } from './local-storage.js';
import { AlmacenS3 } from './s3-storage.js';
import { ArchivosControlador } from './files.controller.js';
import { ArchivosServicio } from './files.service.js';

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
