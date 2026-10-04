import { Global, Module } from '@nestjs/common';
import { Configuracion } from '../../config/configuracion.js';
import { AlmacenArchivos } from './almacen-archivos.js';
import { crearAlmacen } from './crear-almacen.js';
import { ArchivosControlador } from './archivos.controlador.js';
import { ArchivosServicio } from './archivos.servicio.js';

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
