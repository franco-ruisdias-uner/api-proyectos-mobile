import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { ErrorDeApi } from './error-de-api.js';

function primerMensaje(errores: ValidationError[], ruta = ''): string | null {
  for (const error of errores) {
    const campo = ruta ? `${ruta}.${error.property}` : error.property;
    const restricciones = error.constraints ?? {};
    if (restricciones.whitelistValidation) return `No se esperaba el dato «${campo}».`;
    // Si falta, se dice eso. Si no, class-validator deja las restricciones de abajo hacia
    // arriba: la última es la primera escrita en el DTO (el tipo antes que los rangos).
    const primera = restricciones.isDefined ?? Object.values(restricciones).at(-1);
    if (primera) return primera;
    const enHijos = primerMensaje(error.children ?? [], campo);
    if (enHijos) return enHijos;
  }
  return null;
}

/** Mensaje en castellano que nombra el primer campo con problemas (AGENTS §7.3). */
export function mensajeDeValidacion(errores: ValidationError[]): string {
  return primerMensaje(errores) ?? 'Revisá los datos que mandaste.';
}

export function crearValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errores) =>
      new ErrorDeApi('VALIDACION_FALLIDA', mensajeDeValidacion(errores)),
  });
}
