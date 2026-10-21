import { Global, Module } from '@nestjs/common';
import { ENTORNO, type Entorno } from '../../config/environment.js';
import { ALMACEN_ARCHIVOS } from './file-storage.js';
import { crearAlmacen } from './create-storage.js';
import { ArchivosControlador } from './files.controller.js';
import { ArchivosServicio } from './files.service.js';

@Global()
@Module({
  controllers: [ArchivosControlador],
  providers: [
    ArchivosServicio,
    {
      provide: ALMACEN_ARCHIVOS,
      inject: [ENTORNO],
      useFactory: async (entorno: Entorno) => {
        const almacen = crearAlmacen(entorno);
        await almacen.prepararse();
        return almacen;
      },
    },
  ],
  exports: [ArchivosServicio, ALMACEN_ARCHIVOS],
})
export class ArchivosModulo {}
