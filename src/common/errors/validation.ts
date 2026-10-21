import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { ErrorApi } from './error-api.js';

function primerError(errores: ValidationError[]): ValidationError | undefined {
  for (const error of errores) {
    if (error.constraints && Object.keys(error.constraints).length > 0)
      return error;
    const hijo = primerError(error.children ?? []);
    if (hijo) return hijo;
  }
  return undefined;
}

/** Mensaje en castellano del primer campo con problemas. */
export function mensajeDeValidacion(errores: ValidationError[]): string {
  const error = primerError(errores);
  if (!error?.constraints) return 'Hay un dato que no está bien.';
  if (error.constraints.whitelistValidation) {
    return `El dato "${error.property}" no corresponde a este pedido.`;
  }
  // Los decoradores de los DTO traen su mensaje en castellano. class-validator los corre
  // de abajo hacia arriba, así que el último que falló es el de más arriba en el DTO
  // (el más general: "Falta el legajo." antes que "es demasiado largo").
  const mensajes = Object.values(error.constraints);
  return mensajes[mensajes.length - 1];
}

export function crearValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errores) =>
      new ErrorApi('VALIDACION_FALLIDA', mensajeDeValidacion(errores)),
  });
}
