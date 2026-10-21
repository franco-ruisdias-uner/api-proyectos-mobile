import type { ValidationError } from 'class-validator';
import { ErrorApi } from './error-api.js';

function primeraHoja(
  errores: ValidationError[],
  ruta: string[] = [],
): { ruta: string[]; error: ValidationError } | null {
  for (const e of errores) {
    if (e.constraints && Object.keys(e.constraints).length > 0)
      return { ruta: [...ruta, e.property], error: e };
    const hijo = primeraHoja(e.children ?? [], [...ruta, e.property]);
    if (hijo) return hijo;
  }
  return null;
}

/**
 * Errores de class-validator → VALIDACION_FALLIDA con un mensaje en castellano sobre el primer
 * campo con problemas (AGENTS §7.3). Los DTO traen sus mensajes; esto cubre lo que no.
 */
export function errorDeValidacion(errores: ValidationError[]): ErrorApi {
  const hoja = primeraHoja(errores);
  if (!hoja) return new ErrorApi('VALIDACION_FALLIDA');
  const campo = hoja.ruta.join('.');
  const restricciones = hoja.error.constraints ?? {};
  if (restricciones.whitelistValidation) {
    return new ErrorApi('VALIDACION_FALLIDA', `No se esperaba el dato «${campo}».`);
  }
  const mensaje = Object.values(restricciones)[0];
  // Los mensajes por defecto de class-validator están en inglés y empiezan con el nombre del campo.
  if (
    !mensaje ||
    mensaje.startsWith(hoja.error.property + ' ') ||
    /^(each value|nested property)/.test(mensaje)
  ) {
    return new ErrorApi('VALIDACION_FALLIDA', `El dato «${campo}» no es válido.`);
  }
  return new ErrorApi('VALIDACION_FALLIDA', mensaje);
}
