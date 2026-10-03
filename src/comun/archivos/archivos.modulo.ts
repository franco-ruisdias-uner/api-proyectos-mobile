import { Global, Module } from '@nestjs/common';
import { ENTORNO, type Entorno } from '../../config/entorno.js';
import { ALMACEN_ARCHIVOS } from './almacen-archivos.js';
import { AlmacenLocal } from './almacen-local.js';
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
        // Hoy sólo hay disco; el módulo «Nube» suma los proveedores compatibles con S3.
        const almacen = new AlmacenLocal(entorno.directorioArchivos);
        await almacen.prepararse();
        return almacen;
      },
    },
  ],
  exports: [ArchivosServicio, ALMACEN_ARCHIVOS],
})
export class ArchivosModulo {}
