import { Injectable } from '@nestjs/common';
import type { ArchivoSubido } from '../../../contract/api.js';
import { ErrorApi } from '../errors/catalog.js';
import { Reloj } from '../clock/clock.js';
import {
  AlmacenArchivos,
  AlmacenNoDisponible,
  type LecturaArchivo,
  type RangoBytes,
} from './file-storage.js';
import { claveDesdeUrl, esClaveValida, nuevaClave } from './keys.js';
import { urlDeArchivo } from './origin.js';
import { detectarTipoArchivo, LIMITE_POR_TIPO } from './file-types.js';

export interface ArchivoRecibido {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Injectable()
export class ServicioArchivos {
  constructor(
    private readonly almacen: AlmacenArchivos,
    private readonly reloj: Reloj,
  ) {}

  /** Valida firma y tamaño, guarda con una clave nueva y devuelve la URL absoluta. */
  async subir(archivo: ArchivoRecibido): Promise<ArchivoSubido> {
    const detectado = detectarTipoArchivo(
      archivo.buffer,
      archivo.mimetype,
      archivo.originalname,
    );
    if (!detectado) throw new ErrorApi('TIPO_DE_ARCHIVO_NO_PERMITIDO');
    const limite = LIMITE_POR_TIPO[detectado.tipo];
    if (archivo.size > limite) {
      throw new ErrorApi(
        'ARCHIVO_DEMASIADO_GRANDE',
        `El archivo es demasiado grande: ${detectado.tipo === 'imagen' ? 'una foto' : `un ${detectado.tipo}`} puede pesar hasta ${limite / (1024 * 1024)} MB.`,
      );
    }
    const clave = nuevaClave(
      detectado.tipo,
      detectado.extension,
      this.reloj.ahora(),
    );
    await this.envolver(() =>
      this.almacen.guardar(clave, archivo.buffer, detectado.mime),
    );
    return {
      url: urlDeArchivo(clave),
      tipo: detectado.tipo,
      bytes: archivo.size,
    };
  }

  async leer(clave: string, rango?: RangoBytes): Promise<LecturaArchivo> {
    if (!esClaveValida(clave)) throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');
    return this.envolver(() => this.almacen.leer(clave, rango));
  }

  async urlFirmada(clave: string, segundos: number): Promise<string> {
    if (!esClaveValida(clave)) throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');
    if (!(await this.envolver(() => this.almacen.existe(clave))))
      throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');
    return this.envolver(() => this.almacen.urlFirmada!(clave, segundos));
  }

  async tamano(clave: string): Promise<number> {
    const lectura = await this.leer(clave, { inicio: 0, fin: 0 });
    lectura.flujo.destroy();
    return lectura.bytesTotales;
  }

  /**
   * Clave de una URL que llega en un recurso, o null si no es de /archivos de esta API o el
   * archivo no existe (AGENTS §8). Quien la usa decide el error (ARCHIVO_NO_SUBIDO).
   */
  async claveSubida(url: string): Promise<string | null> {
    const clave = claveDesdeUrl(url);
    if (clave === null) return null;
    return (await this.envolver(() => this.almacen.existe(clave)))
      ? clave
      : null;
  }

  private async envolver<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof AlmacenNoDisponible)
        throw new ErrorApi('ALMACEN_NO_DISPONIBLE');
      if ((e as Error | null)?.name === 'ArchivoNoEncontrado')
        throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');
      throw e;
    }
  }
}
