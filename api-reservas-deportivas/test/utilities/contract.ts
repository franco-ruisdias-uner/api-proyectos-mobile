// Validación de respuestas contra el contrato (AGENTS §10.3).
// El esquema sale de contract/types.ts y contract/api.ts con `pnpm contrato:esquema`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv } from 'ajv';
import type { Response } from 'supertest';

const esquema = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../contract/schema.json'), 'utf8'),
) as { definitions: Record<string, unknown> };

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(esquema, 'contract');

export const DEFINICIONES = Object.keys(esquema.definitions);

const INSTANTE_CORRECTO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;
const PARECE_INSTANTE = /^\d{4}-\d{2}-\d{2}T/;

function validarDefinicion(valor: unknown, definicion: string): void {
  const validar = ajv.getSchema(`contract#/definitions/${definicion}`);
  if (!validar)
    throw new Error(`El contrato no tiene la definición «${definicion}».`);
  if (!validar(valor)) {
    throw new Error(
      `No cumple el contrato de ${definicion}: ${ajv.errorsText(validar.errors)}\n` +
        JSON.stringify(valor, null, 2),
    );
  }
}

/** Recorre el valor y revisa las convenciones del PRD que el esquema no expresa. */
function revisarConvenciones(valor: unknown, ruta: string): void {
  if (typeof valor === 'string') {
    if (valor === '')
      throw new Error(`${ruta} es "" (tiene que ser null o tener valor).`);
    if (PARECE_INSTANTE.test(valor) && !INSTANTE_CORRECTO.test(valor)) {
      throw new Error(`${ruta} = "${valor}" no es AAAA-MM-DDTHH:MM:SS-03:00.`);
    }
    return;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => revisarConvenciones(v, `${ruta}[${i}]`));
    return;
  }
  if (valor !== null && typeof valor === 'object') {
    for (const [clave, v] of Object.entries(valor)) {
      if ((clave === 'id' || clave.endsWith('Id')) && typeof v === 'number') {
        throw new Error(`${ruta}.${clave} es un número: los ids son texto.`);
      }
      revisarConvenciones(v, `${ruta}.${clave}`);
    }
  }
}

/**
 * Verifica el sobre ({ datos, meta }) y que cada elemento de `datos` cumpla la
 * definición pedida del contrato. Devuelve `datos` tipado para seguir con asserts.
 */
export function esperarContrato<T = unknown>(
  cuerpo: unknown,
  definicion: string,
): T {
  if (cuerpo === null || typeof cuerpo !== 'object') {
    throw new Error(`La respuesta no es un objeto: ${JSON.stringify(cuerpo)}`);
  }
  const claves = Object.keys(cuerpo).sort();
  if (claves.join(',') !== 'datos,meta') {
    throw new Error(
      `El sobre tiene que ser { datos, meta } y vino { ${claves.join(', ')} }.`,
    );
  }
  const { datos, meta } = cuerpo as { datos: unknown; meta: unknown };
  if (Array.isArray(datos)) {
    validarDefinicion(meta, 'Meta');
    datos.forEach((d) => validarDefinicion(d, definicion));
  } else {
    if (meta !== null)
      throw new Error(
        `Un solo recurso lleva meta: null y vino ${JSON.stringify(meta)}.`,
      );
    validarDefinicion(datos, definicion);
  }
  revisarConvenciones(datos, 'datos');
  return datos as T;
}

/** Verifica estado HTTP y sobre de error exacto: { error: { codigo, mensaje } }. */
export function esperarError(
  res: Response,
  estado: number,
  codigo: string,
): void {
  const cuerpo: unknown = res.body;
  if (res.status !== estado) {
    throw new Error(
      `Se esperaba ${estado} ${codigo} y vino ${res.status}: ${JSON.stringify(cuerpo)}`,
    );
  }
  validarDefinicion(cuerpo, 'RespuestaError');
  const { error } = cuerpo as { error: { codigo: string; mensaje: string } };
  if (error.codigo !== codigo) {
    throw new Error(
      `Se esperaba el código ${codigo} y vino ${error.codigo} («${error.mensaje}»).`,
    );
  }
  if (error.mensaje.trim() === '')
    throw new Error('El mensaje de error está vacío.');
}
