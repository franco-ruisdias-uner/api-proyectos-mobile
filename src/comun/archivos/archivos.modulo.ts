import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { ErrorDeConfiguracion } from '../../config/entorno.js';
import { AlmacenNoDisponible } from './almacen-archivos.js';
import { ENTORNO } from '../../config/entorno.modulo.js';
import type { Entorno } from '../../config/entorno.js';
import { AlmacenArchivos } from './almacen-archivos.js';
import { AlmacenDisco } from './almacen-disco.js';
import { AlmacenS3 } from './almacen-s3.js';
import { ControladorArchivos } from './archivos.controlador.js';
import { ServicioArchivos } from './archivos.servicio.js';

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
