import type { ValidationError } from 'class-validator';
import { ErrorApi } from './error-api.js';

function primerError(errores: ValidationError[]): ValidationError | undefined {
  for (const error of errores) {
    if (error.constraints && Object.keys(error.constraints).length > 0) return error;
    const hijo = primerError(error.children ?? []);
    if (hijo) return hijo;
  }
  return undefined;
}

/**
 * Convierte los errores de class-validator en un `VALIDACION_FALLIDA` con un mensaje en
 * castellano que nombra el primer campo con problemas. Cada DTO escribe sus mensajes.
 */
export function errorDeValidacion(errores: ValidationError[]): ErrorApi {
  const error = primerError(errores);
  if (!error?.constraints) return new ErrorApi('VALIDACION_FALLIDA');
  if (error.constraints.whitelistValidation) {
    return new ErrorApi('VALIDACION_FALLIDA', 'El pedido trae datos que no corresponden.');
  }
  // Se muestra la primera restricción que falló en el orden en que están escritas en el DTO
  // (class-validator las junta al revés: los decoradores se aplican de abajo hacia arriba).
  // Si alguna no tiene mensaje propio (texto en inglés de class-validator), va uno genérico.
  const mensaje = Object.values(error.constraints)
    .reverse()
    .find((m) => !/\b(must|should)\b/.test(m));
  return new ErrorApi('VALIDACION_FALLIDA', mensaje ?? 'Revisá los datos que mandaste.');
}
