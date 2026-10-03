import { Global, Module } from '@nestjs/common';
import { ENTORNO, type Entorno } from '../../config/entorno.js';
import { ALMACEN_ARCHIVOS } from './almacen-archivos.js';
import { crearAlmacen } from './crear-almacen.js';
import { ArchivosControlador } from './archivos.controlador.js';
import { ArchivosServicio } from './archivos.servicio.js';

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
