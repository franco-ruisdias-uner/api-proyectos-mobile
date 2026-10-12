import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Configuracion, valor } from '../../config/configuracion.js';
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
      inject: [ConfigService],
      useFactory: async (config: Configuracion): Promise<AlmacenArchivos> => {
        const almacen = new AlmacenDisco(valor(config, 'DIRECTORIO_ARCHIVOS'));
        await almacen.prepararse();
        return almacen;
      },
    },
    ArchivosServicio,
  ],
  exports: [AlmacenArchivos, ArchivosServicio],
})
export class ArchivosModulo {}
