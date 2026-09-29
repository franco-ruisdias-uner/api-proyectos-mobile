import { ValidationPipe } from '@nestjs/common';
import { ErrorApi } from '../errores/catalogo.js';
import { mensajeDeValidacion } from './mensajes.js';

/** ValidationPipe global (AGENTS §7.3): whitelist estricta y mensajes en castellano. */
export const crearPipeValidacion = (): ValidationPipe =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: true },
    exceptionFactory: (errores) =>
      new ErrorApi('VALIDACION_FALLIDA', mensajeDeValidacion(errores)),
  });
