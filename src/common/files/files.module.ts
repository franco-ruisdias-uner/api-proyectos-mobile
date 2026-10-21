import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { ErrorDeConfiguracion } from '../../config/environment.js';
import { AlmacenNoDisponible } from './file-storage.js';
import { ENTORNO } from '../../config/environment.module.js';
import type { Entorno } from '../../config/environment.js';
import { AlmacenArchivos } from './file-storage.js';
import { AlmacenDisco } from './local-storage.js';
import { AlmacenS3 } from './s3-storage.js';
import { ControladorArchivos } from './files.controller.js';
import { ServicioArchivos } from './files.service.js';

/** Elige el adaptador según ARCHIVOS_PROVEEDOR: disco o S3 (todos los demás hablan S3). */
export function crearAlmacen(entorno: Entorno): AlmacenArchivos {
  if (entorno.S3) return new AlmacenS3(entorno.S3);
  return new AlmacenDisco(entorno.DIRECTORIO_ARCHIVOS);
}

@Global()
@Module({
  controllers: [ControladorArchivos],
  providers: [
    { provide: AlmacenArchivos, inject: [ENTORNO], useFactory: crearAlmacen },
    ServicioArchivos,
  ],
  exports: [AlmacenArchivos, ServicioArchivos],
})
export class ArchivosModulo implements OnModuleInit {
  constructor(private readonly almacen: AlmacenArchivos) {}

  /** Si el almacén no está accesible, la API no arranca y dice qué revisar. */
  async onModuleInit(): Promise<void> {
    try {
      await this.almacen.prepararse();
    } catch (e) {
      if (!(e instanceof AlmacenNoDisponible)) throw e;
      const causa = (e.cause as Error | undefined)?.message ?? 'sin detalle';
      throw new ErrorDeConfiguracion([
        `No se pudo acceder al almacén de archivos (${this.almacen.proveedor}): ${causa}. Revisá S3_BUCKET, S3_REGION, las claves S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY y, si es un emulador, que esté levantado. Podés probarlo con: pnpm archivos:probar`,
      ]);
    }
  }
}
