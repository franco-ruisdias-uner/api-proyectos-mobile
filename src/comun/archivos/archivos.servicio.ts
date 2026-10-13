import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Configuracion, valor } from '../../config/configuracion.js';
import type { ArchivoSubido } from '../../../contrato/api.js';
import { ErrorApi } from '../errores/error-api.js';
import { origenActual } from '../origen/origen.js';
import { Reloj } from '../reloj/reloj.js';
import { ZONA } from '../fechas/fechas.js';
import { TZDate } from '@date-fns/tz';
import {
  AlmacenArchivos,
  ArchivoNoEncontrado,
  esClaveValida,
  type LecturaArchivo,
  type Rango,
} from './almacen-archivos.js';
import {
  CARPETA,
  claveDeUrl,
  detectarFormato,
  LIMITE_BYTES,
  urlDeArchivo,
} from './reglas.js';

@Injectable()
export class ArchivosServicio {
  private readonly log = new Logger('Archivos');

  constructor(
    private readonly almacen: AlmacenArchivos,
    private readonly reloj: Reloj,
    @Optional() @Inject(ConfigService) private readonly config?: Configuracion,
  ) {}

  /**
   * Con ARCHIVOS_REDIRIGIR=true (sólo proveedores en la nube): URL firmada de 15 minutos a la
   * que redirigir en vez de pasar el archivo por la API. `null` si no corresponde.
   */
  async redireccion(clave: string): Promise<string | null> {
    if (!this.config || !valor(this.config, 'ARCHIVOS_S3')?.redirigir)
      return null;
    if (!esClaveValida(clave) || !this.almacen.urlFirmada) return null;
    try {
      if (!(await this.almacen.existe(clave)))
        throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');
      return await this.almacen.urlFirmada(clave, 15 * 60);
    } catch (error) {
      if (error instanceof ErrorApi) throw error;
      this.log.error(`No se pudo firmar ${clave}: ${String(error)}`);
      throw new ErrorApi('ALMACEN_NO_DISPONIBLE');
    }
  }

  /** Guarda lo que subió el teléfono. La clave la genera el servidor. */
  async subir(contenido: Buffer): Promise<ArchivoSubido> {
    const formato = detectarFormato(contenido);
    if (!formato) throw new ErrorApi('TIPO_DE_ARCHIVO_NO_PERMITIDO');
    if (contenido.length > LIMITE_BYTES[formato.tipo]) {
      const mb = LIMITE_BYTES[formato.tipo] / (1024 * 1024);
      const nombre = {
        imagen: 'una foto',
        audio: 'un audio',
        video: 'un video',
      }[formato.tipo];
      throw new ErrorApi(
        'ARCHIVO_DEMASIADO_GRANDE',
        `El archivo es demasiado grande: ${nombre} puede pesar hasta ${mb} MB.`,
      );
    }
    const clave = await this.guardar(
      contenido,
      formato.tipo,
      formato.extension,
      formato.tipoMime,
    );
    return {
      url: this.url(clave),
      tipo: formato.tipo,
      bytes: contenido.length,
    };
  }

  /** Guarda un archivo con una clave nueva y la devuelve (lo usan también las semillas). */
  async guardar(
    contenido: Buffer,
    tipo: keyof typeof CARPETA,
    extension: string,
    tipoMime: string,
  ): Promise<string> {
    const ahora = new TZDate(this.reloj.ahora().getTime(), ZONA);
    const anio = String(ahora.getFullYear());
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const id = randomBytes(12).toString('hex');
    const clave = `${CARPETA[tipo]}/${anio}/${mes}/${id}.${extension}`;
    try {
      await this.almacen.guardar(clave, contenido, tipoMime);
    } catch (error) {
      this.log.error(`No se pudo guardar ${clave}: ${String(error)}`);
      throw new ErrorApi('ALMACEN_NO_DISPONIBLE');
    }
    return clave;
  }

  async leer(clave: string, rango?: Rango): Promise<LecturaArchivo> {
    if (!esClaveValida(clave)) throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');
    try {
      return await this.almacen.leer(clave, rango);
    } catch (error) {
      if (error instanceof ArchivoNoEncontrado)
        throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');
      this.log.error(`No se pudo leer ${clave}: ${String(error)}`);
      throw new ErrorApi('ALMACEN_NO_DISPONIBLE');
    }
  }

  /** URL absoluta de un archivo guardado, con el origen del pedido en curso. */
  url(clave: string): string {
    return urlDeArchivo(origenActual(), clave);
  }

  /**
   * Para los recursos que traen una URL de archivo (fotos, audios): devuelve la clave si
   * es un archivo subido a esta API; si no (un `file://`, otra URL, uno que no existe),
   * ARCHIVO_NO_SUBIDO.
   */
  async claveDeArchivoSubido(url: string): Promise<string> {
    const clave = claveDeUrl(url);
    if (
      clave === null ||
      !esClaveValida(clave) ||
      !(await this.almacen.existe(clave))
    ) {
      throw new ErrorApi('ARCHIVO_NO_SUBIDO');
    }
    return clave;
  }
}
