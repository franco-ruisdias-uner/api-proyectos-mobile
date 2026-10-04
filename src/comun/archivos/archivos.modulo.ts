import { Global, Module } from '@nestjs/common';
import { Configuracion } from '../../config/configuracion.js';
import { AlmacenArchivos } from './almacen-archivos.js';
import { AlmacenDisco } from './almacen-disco.js';
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
        // M0 sólo trae el adaptador de disco; el de S3 llega con el módulo «Nube».
        const almacen = new AlmacenDisco(config.archivos.directorio);
        await almacen.prepararse();
        return almacen;
      },
    },
    ArchivosServicio,
  ],
  exports: [AlmacenArchivos, ArchivosServicio],
})
export class ArchivosModulo {}
