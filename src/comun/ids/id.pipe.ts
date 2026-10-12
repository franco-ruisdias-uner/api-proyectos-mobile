import { Injectable, type PipeTransform } from '@nestjs/common';
import { ErrorApi } from '../errores/error-api.js';
import { esIdDe } from './ids.js';

/** Valida el prefijo de un id que llega por la ruta antes de ir a la base. */
@Injectable()
export class IdPipe implements PipeTransform<unknown, string> {
  constructor(private readonly prefijo: string) {}

  transform(valor: unknown): string {
    if (!esIdDe(this.prefijo, valor)) {
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'El identificador no es válido.',
      );
    }
    return valor;
  }
}
