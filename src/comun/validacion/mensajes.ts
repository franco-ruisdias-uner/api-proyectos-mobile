// Mensaje de VALIDACION_FALLIDA: nombra el primer campo con problemas, en castellano (AGENTS §7.3).
import type { ValidationError } from 'class-validator';

/**
 * Cómo se nombra cada campo en una frase ("Falta <etiqueta>."). Los campos que no están
 * acá se nombran entre comillas, tal cual: están en castellano porque el dominio lo está.
 */
const ETIQUETAS: Record<string, string> = {
  nombre: 'el nombre',
  email: 'el email',
  contrasena: 'la contraseña',
  telefono: 'el teléfono',
  avisosActivos: 'si querés recibir avisos',
  tokenExpo: 'el token de notificaciones',
  plataforma: 'la plataforma del teléfono',
  archivo: 'el archivo',
  pagina: 'el número de página',
  porPagina: 'la cantidad por página',
  latitud: 'la latitud',
  longitud: 'la longitud',
};

const etiqueta = (campo: string): string => ETIQUETAS[campo] ?? `«${campo}»`;

/** Restricciones que, con el valor ausente, quieren decir "falta". */
const DE_PRESENCIA = new Set([
  'isNotEmpty',
  'isDefined',
  'isString',
  'isNumber',
  'isInt',
  'isBoolean',
  'isIn',
  'isEmail',
]);

function primerError(errores: ValidationError[]): ValidationError | undefined {
  for (const e of errores) {
    if (e.constraints && Object.keys(e.constraints).length > 0) return e;
    const hijo = e.children?.length ? primerError(e.children) : undefined;
    if (hijo) return hijo;
  }
  return undefined;
}

export function mensajeDeValidacion(errores: ValidationError[]): string {
  const e = primerError(errores);
  if (!e?.constraints) return 'Revisá los datos que mandaste.';
  const restricciones = Object.keys(e.constraints);

  if (restricciones.includes('whitelistValidation')) {
    return `No se puede mandar «${e.property}» en este pedido.`;
  }
  const vacio =
    e.value === undefined ||
    e.value === null ||
    (typeof e.value === 'string' && e.value.trim() === '');
  if (vacio && restricciones.some((r) => DE_PRESENCIA.has(r))) {
    return `Falta ${etiqueta(e.property)}.`;
  }

  for (const r of restricciones) {
    const propio = (e.contexts?.[r] as { mensaje?: string } | undefined)
      ?.mensaje;
    if (propio) return propio;
  }
  return `Revisá ${etiqueta(e.property)}: no tiene el formato correcto.`;
}
