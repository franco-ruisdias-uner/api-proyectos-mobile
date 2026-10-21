import { Injectable } from '@nestjs/common';
import { ErrorApi } from '../errors/error-api.js';
import { AlmacenArchivos } from './file-storage.js';
import type { TipoArchivo } from './signatures.js';
import { claveDeUrl } from './urls.js';

const CARPETA: Record<TipoArchivo, string> = { imagen: 'imagenes/', audio: 'audios/', video: 'videos/' };

/**
 * Chequea que una URL que llega en un recurso sea de un archivo subido con `POST /archivos`
 * (AGENTS §8, R13). Un `file://`, una URL ajena o una clave que no existe → `ARCHIVO_NO_SUBIDO`.
 */
@Injectable()
export class VerificadorArchivos {
  constructor(private readonly almacen: AlmacenArchivos) {}

  async claveSubida(url: string, tipo: TipoArchivo): Promise<string> {
    const clave = claveDeUrl(url);
    if (!clave || !clave.startsWith(CARPETA[tipo]) || !(await this.almacen.existe(clave))) {
      throw new ErrorApi('ARCHIVO_NO_SUBIDO');
    }
    return clave;
  }
}
