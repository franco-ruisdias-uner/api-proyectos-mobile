import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Configuracion, valor } from '../../config/configuracion.js';
import { AlmacenArchivos } from './almacen-archivos.js';
import { AlmacenS3 } from './almacen-s3.js';
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
        const s3 = valor(config, 'ARCHIVOS_S3');
        const almacen = s3
          ? new AlmacenS3(s3, valor(config, 'ENTORNO') === 'test' ? 3 : 10)
          : new AlmacenDisco(valor(config, 'DIRECTORIO_ARCHIVOS'));
        await almacen.prepararse();
        return almacen;
      },
    },
    ArchivosServicio,
  ],
  exports: [AlmacenArchivos, ArchivosServicio],
})
export class ArchivosModulo {}
