import { Inject, Injectable } from '@nestjs/common';
import type { ArchivoSubido } from '../../../contrato/api.js';
import { origenActual } from '../contexto/contexto-pedido.js';
import { ErrorApi } from '../errores/error-api.js';
import { Reloj } from '../reloj/reloj.js';
import {
  ALMACEN_ARCHIVOS,
  type AlmacenArchivos,
  AlmacenNoDisponible,
  ArchivoNoEncontrado,
  type LecturaArchivo,
} from './almacen-archivos.js';
import { claveDesdeUrl, esClaveValida, nuevaClave } from './reglas/claves.js';
import { parsearRango } from './reglas/rango.js';
import { detectarTipoArchivo } from './reglas/tipos-archivo.js';

export interface DescargaArchivo extends LecturaArchivo {
  rango: { inicio: number; fin: number } | null;
}

@Injectable()
export class ArchivosServicio {
  constructor(
    @Inject(ALMACEN_ARCHIVOS) private readonly almacen: AlmacenArchivos,
    private readonly reloj: Reloj,
  ) {}

  /** Valida la firma y el tamaño, guarda con una clave nueva y devuelve la URL absoluta. */
  async subir(contenido: Buffer): Promise<ArchivoSubido> {
    const formato = detectarTipoArchivo(contenido);
    if (!formato) throw new ErrorApi('TIPO_DE_ARCHIVO_NO_PERMITIDO');
    if (contenido.length > formato.maxBytes) throw new ErrorApi('ARCHIVO_DEMASIADO_GRANDE');

    const clave = nuevaClave(formato.tipo, formato.ext, this.reloj.ahora());
    await this.conAlmacen(() => this.almacen.guardar(clave, contenido, formato.mime));
    return { url: urlDeArchivo(clave), tipo: formato.tipo, bytes: contenido.length };
  }

  async descargar(clave: string, cabeceraRango: string | undefined): Promise<DescargaArchivo> {
    if (!esClaveValida(clave)) throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');
    const completo = await this.conAlmacen(() => this.almacen.leer(clave));
    const rango = parsearRango(cabeceraRango, completo.bytesTotales);
    if (rango === null) return { ...completo, rango: null };

    completo.flujo.destroy();
    if (rango === 'no-satisfacible') {
      const error = new ErrorApi('RANGO_NO_SATISFACIBLE');
      throw Object.assign(error, { bytesTotales: completo.bytesTotales });
    }
    const parcial = await this.conAlmacen(() => this.almacen.leer(clave, rango));
    return { ...parcial, rango };
  }

  /**
   * Para los recursos que traen una URL de foto o video (AGENTS §8): tiene que ser de
   * /archivos de esta API y el archivo tiene que existir. Devuelve la clave a guardar.
   */
  async claveDeUrlSubida(url: string): Promise<string> {
    const clave = claveDesdeUrl(url);
    if (!clave || !(await this.conAlmacen(() => this.almacen.existe(clave)))) {
      throw new ErrorApi('ARCHIVO_NO_SUBIDO');
    }
    return clave;
  }

  private async conAlmacen<T>(operacion: () => Promise<T>): Promise<T> {
    try {
      return await operacion();
    } catch (error) {
      if (error instanceof ArchivoNoEncontrado) throw new ErrorApi('ARCHIVO_NO_ENCONTRADO');
      if (error instanceof ErrorApi) throw error;
      throw new ErrorApi('ALMACEN_NO_DISPONIBLE');
    }
  }
}

/** Clave guardada en la base → URL absoluta con el origen del pedido (AGENTS §8). */
export function urlDeArchivo(clave: string): string {
  return `${origenActual()}/archivos/${clave}`;
}

export { AlmacenNoDisponible };
