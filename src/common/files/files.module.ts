import { Global, Module } from '@nestjs/common';
import { Configuracion } from '../../config/environment.js';
import { AlmacenArchivos } from './file-storage.js';
import { crearAlmacen } from './create-storage.js';
import { ArchivosControlador } from './files.controller.js';
import { ArchivosServicio } from './files.service.js';

@Global()
@Module({
  controllers: [ArchivosControlador],
  providers: [
    {
      provide: AlmacenArchivos,
      inject: [Configuracion],
      useFactory: async (config: Configuracion): Promise<AlmacenArchivos> => {
        const almacen = crearAlmacen(config);
        await almacen.prepararse();
        return almacen;
      },
    },
    ArchivosServicio,
  ],
  exports: [AlmacenArchivos, ArchivosServicio],
})
export class ArchivosModulo {}
