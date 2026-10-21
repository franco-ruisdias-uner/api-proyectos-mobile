import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ArchivoSubido } from '../../../contract/api.js';
import { CONFIGURACION, type Configuracion } from '../../config/environment.js';
import { origenActual } from '../context/request-context.js';
import { ErrorDeApi } from '../errors/error-api.js';
import { Reloj } from '../clock/clock.js';
import {
  ALMACEN_ARCHIVOS,
  type AlmacenArchivos,
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
  type LecturaArchivo,
} from './file-storage.js';
import { claveDeUrl, esClaveValida, nuevaClave } from './keys.js';
import { detectarTipoDeArchivo, LIMITE_DE_BYTES, type TipoDeArchivo } from './signature.js';
import type { Rango } from './range.js';

@Injectable()
export class ArchivosServicio implements OnModuleInit {
  constructor(
    @Inject(ALMACEN_ARCHIVOS) private readonly almacen: AlmacenArchivos,
    @Inject(CONFIGURACION) private readonly config: Configuracion,
    private readonly reloj: Reloj,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.almacen.prepararse();
  }

  get proveedor() {
    return this.almacen.proveedor;
  }

  /** URL absoluta de una clave: URL_PUBLICA o el origen del pedido (AGENTS §8). */
  urlDe(clave: string): string {
    return `${this.config.urlPublica ?? origenActual()}/archivos/${clave}`;
  }

  async subir(contenido: Buffer): Promise<ArchivoSubido> {
    const detectado = detectarTipoDeArchivo(contenido);
    if (!detectado) throw new ErrorDeApi('TIPO_DE_ARCHIVO_NO_PERMITIDO');
    const limite = LIMITE_DE_BYTES[detectado.tipo];
    if (contenido.length > limite) {
      throw new ErrorDeApi(
        'ARCHIVO_DEMASIADO_GRANDE',
        `El archivo es demasiado grande: ${detectado.tipo === 'imagen' ? 'una foto' : `un ${detectado.tipo}`} puede pesar hasta ${limite / 1024 / 1024} MB.`,
      );
    }
    const clave = nuevaClave(detectado.tipo, detectado.extension, this.reloj.ahora());
    await this.conAlmacen(() => this.almacen.guardar(clave, contenido, detectado.mime));
    return { url: this.urlDe(clave), tipo: detectado.tipo, bytes: contenido.length };
  }

  async leer(clave: string, rango?: Rango): Promise<LecturaArchivo> {
    if (!esClaveValida(clave)) throw new ErrorDeApi('ARCHIVO_NO_ENCONTRADO');
    return this.conAlmacen(() => this.almacen.leer(clave, rango));
  }

  /** Tamaño total, pidiendo sólo el primer byte (en S3 no baja el archivo entero). */
  async tamanio(clave: string): Promise<number> {
    const lectura = await this.leer(clave, { inicio: 0, fin: 0 });
    lectura.flujo.destroy();
    return lectura.bytesTotales;
  }

  /** Si ARCHIVOS_REDIRIGIR está activo y el proveedor lo permite, la URL firmada; si no, null. */
  async urlFirmada(clave: string): Promise<string | null> {
    if (!this.config.archivos.redirigir || !this.almacen.urlFirmada) return null;
    return this.conAlmacen(() => this.almacen.urlFirmada!(clave));
  }

  /**
   * Para los recursos que traen una URL de archivo (foto de un reporte, video de un aviso):
   * devuelve la clave si la URL es de esta API, el archivo existe y es del tipo esperado;
   * si no, null. El módulo que lo usa decide el error (ARCHIVO_NO_SUBIDO).
   */
  async claveSubida(url: string, tipo: TipoDeArchivo): Promise<string | null> {
    const clave = claveDeUrl(url);
    if (!clave || !clave.startsWith(`${tipo === 'imagen' ? 'imagenes' : `${tipo}s`}/`)) return null;
    return (await this.conAlmacen(() => this.almacen.existe(clave))) ? clave : null;
  }

  /** Guarda un archivo con una clave ya armada (lo usan las semillas). */
  async guardarConClave(clave: string, contenido: Buffer, tipoMime: string): Promise<void> {
    await this.conAlmacen(() => this.almacen.guardar(clave, contenido, tipoMime));
  }

  private async conAlmacen<T>(operacion: () => Promise<T>): Promise<T> {
    try {
      return await operacion();
    } catch (error) {
      if (error instanceof ArchivoNoEncontrado) throw new ErrorDeApi('ARCHIVO_NO_ENCONTRADO');
      if (error instanceof AlmacenNoDisponible) throw new ErrorDeApi('ALMACEN_NO_DISPONIBLE');
      throw error;
    }
  }
}
