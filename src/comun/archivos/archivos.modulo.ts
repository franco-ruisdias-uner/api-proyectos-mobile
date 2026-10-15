import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../../config/configuration.js';
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
      useFactory: async (
        config: AppConfigService,
      ): Promise<AlmacenArchivos> => {
        const { s3, dir } = config.get('storage', { infer: true });
        const intentos =
          config.get('app.env', { infer: true }) === 'test' ? 3 : 10;
        const almacen = s3
          ? new AlmacenS3(s3, intentos)
          : new AlmacenDisco(dir);
        await almacen.prepararse();
        return almacen;
      },
    },
    ArchivosServicio,
  ],
  exports: [AlmacenArchivos, ArchivosServicio],
})
export class ArchivosModulo {}
