import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../../config/configuration.js';
import { AlmacenArchivos } from './file-storage.js';
import { AlmacenS3 } from './s3-storage.js';
import { AlmacenDisco } from './local-storage.js';
import { ArchivosControlador } from './files.controller.js';
import { ArchivosServicio } from './files.service.js';

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
