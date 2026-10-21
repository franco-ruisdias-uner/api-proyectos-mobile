import { Injectable } from '@nestjs/common';
import type { ArchivoSubido } from '../../../contract/api.js';
import { ErrorApi } from '../errors/error-api.js';
import { Reloj } from '../clock/clock.js';
import { aIsoConZona } from '../dates/dates.js';
import {
  AlmacenArchivos,
  ArchivoNoEncontrado,
  type LecturaArchivo,
  type RangoBytes,
} from './file-storage.js';
import { nuevaClave, urlDeArchivo } from './keys.js';
import { detectarFormato, LIMITE_BYTES } from './file-types.js';

@Injectable()
export class ArchivosServicio {
  constructor(
    private readonly almacen: AlmacenArchivos,
    private readonly reloj: Reloj,
  ) {}

  async subir(contenido: Buffer): Promise<ArchivoSubido> {
    const formato = detectarFormato(contenido);
    if (!formato) throw new ErrorApi('TIPO_DE_ARCHIVO_NO_PERMITIDO');
    if (contenido.length > LIMITE_BYTES[formato.tipo]) {
      const mb = LIMITE_BYTES[formato.tipo] / (1024 * 1024);
      throw new ErrorApi(
        'ARCHIVO_DEMASIADO_GRANDE',
        `El archivo es demasiado grande: puede pesar hasta ${mb} MB.`,
      );
    }
    const [anio, mes] = aIsoConZona(this.reloj.ahora()).split('-');
    const clave = nuevaClave(formato, anio, mes);
    await this.envolver(() =>
      this.almacen.guardar(clave, contenido, formato.mime),
    );
    return {
      url: urlDeArchivo(clave),
      tipo: formato.tipo,
      bytes: contenido.length,
    };
  }

  /** Tamaño total del archivo (para resolver la cabecera Range antes de leer). */
  async tamano(clave: string): Promise<number> {
    const lectura = await this.leer(clave, { inicio: 0, fin: 0 });
    lectura.flujo.destroy();
    return lectura.bytesTotales;
  }

  leer(clave: string, rango?: RangoBytes): Promise<LecturaArchivo> {
    return this.envolver(() => this.almacen.leer(clave, rango));
  }

  private async envolver<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ArchivoNoEncontrado)
        throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');
      if (error instanceof ErrorApi) throw error;
      // AlmacenNoDisponible o cualquier falla del proveedor.
      throw new ErrorApi('ALMACEN_NO_DISPONIBLE');
    }
  }
}
