// esperarContrato(): valida un cuerpo de respuesta contra contrato/esquema.json (AGENTS §10.3).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv, type ValidateFunction } from 'ajv';
import type { Response } from 'supertest';

type Esquema = { definitions: Record<string, unknown> };

const esquema = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../../contrato/esquema.json'),
    'utf8',
  ),
) as Esquema;

export type NombreDeTipo = keyof typeof esquema.definitions & string;

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema({ ...esquema, $id: 'contrato' });

const validadores = new Map<string, ValidateFunction>();
function validador(nombre: string): ValidateFunction {
  let v = validadores.get(nombre);
  if (!v) {
    if (!(nombre in esquema.definitions)) {
      throw new Error(`El tipo «${nombre}» no está en contrato/esquema.json`);
    }
    v = ajv.compile({ $ref: `contrato#/definitions/${nombre}` });
    validadores.set(nombre, v);
  }
  return v;
}

function validar(nombre: string, valor: unknown, donde: string): void {
  const v = validador(nombre);
  if (!v(valor)) {
    throw new Error(
      `${donde} no cumple el contrato de ${nombre}:\n` +
        ajv.errorsText(v.errors, { separator: '\n' }) +
        `\nValor: ${JSON.stringify(valor, null, 2)}`,
    );
  }
}

const PARECE_INSTANTE = /^\d{4}-\d{2}-\d{2}T/;
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;

/** Reglas de AGENTS §4.3 que el esquema no expresa. */
function revisarConvenciones(valor: unknown, ruta: string): void {
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => revisarConvenciones(v, `${ruta}[${i}]`));
    return;
  }
  if (valor !== null && typeof valor === 'object') {
    for (const [clave, v] of Object.entries(valor)) {
      const aca = `${ruta}.${clave}`;
      if (
        (clave === 'id' || clave.endsWith('Id')) &&
        v !== null &&
        typeof v !== 'string'
      ) {
        throw new Error(`${aca} es un id y no es texto: ${JSON.stringify(v)}`);
      }
      if (v === undefined)
        throw new Error(`${aca} está ausente (tiene que ser null)`);
      revisarConvenciones(v, aca);
    }
    return;
  }
  if (typeof valor === 'string') {
    if (valor === '') throw new Error(`${ruta} es "" (sin valor va null)`);
    if (PARECE_INSTANTE.test(valor) && !INSTANTE.test(valor)) {
      throw new Error(`${ruta} no es AAAA-MM-DDTHH:MM:SS-03:00: ${valor}`);
    }
  }
}

function cuerpoDe(respuesta: Response | unknown): unknown {
  return respuesta !== null &&
    typeof respuesta === 'object' &&
    'body' in respuesta &&
    'status' in respuesta
    ? (respuesta as Response).body
    : respuesta;
}

/**
 * Valida el sobre y cada elemento de `datos` contra el tipo pedido.
 * Acepta la respuesta de supertest o el cuerpo ya extraído.
 */
export function esperarContrato(
  respuesta: Response | unknown,
  tipo: NombreDeTipo,
): void {
  const cuerpo = cuerpoDe(respuesta);
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    throw new Error(`El cuerpo no es un sobre: ${JSON.stringify(cuerpo)}`);
  }
  const claves = Object.keys(cuerpo).sort();
  if (claves.join(',') !== 'datos,meta') {
    throw new Error(
      `El sobre tiene que tener exactamente datos y meta, tiene: ${claves.join(', ')}`,
    );
  }
  const { datos, meta } = cuerpo as { datos: unknown; meta: unknown };
  if (Array.isArray(datos)) {
    validar('Meta', meta, 'meta');
    datos.forEach((d, i) => validar(tipo, d, `datos[${i}]`));
  } else {
    if (meta !== null)
      throw new Error(
        `Un solo recurso lleva meta: null, vino ${JSON.stringify(meta)}`,
      );
    validar(tipo, datos, 'datos');
  }
  revisarConvenciones(cuerpo, '$');
}

/** Valida un registro suelto (por ejemplo, lo que devuelve un mapeador). */
export function esperarForma(valor: unknown, tipo: NombreDeTipo): void {
  validar(tipo, valor, 'valor');
  revisarConvenciones(valor, '$');
}

/** Valida el sobre de error: exactamente { error: { codigo, mensaje } }, con el estado y el código. */
export function esperarError(
  respuesta: Response,
  estado: number,
  codigo: string,
): void {
  const cuerpo = respuesta.body as unknown;
  const detalle = `${respuesta.status} ${JSON.stringify(cuerpo)}`;
  if (respuesta.status !== estado) {
    throw new Error(`Se esperaba ${estado} ${codigo} y vino ${detalle}`);
  }
  validar('RespuestaError', cuerpo, 'error');
  const { error } = cuerpo as { error: { codigo: string; mensaje: string } };
  if (error.codigo !== codigo)
    throw new Error(`Se esperaba ${codigo} y vino ${detalle}`);
  if (error.mensaje.trim() === '')
    throw new Error(`El mensaje de ${codigo} está vacío`);
}

export const definicionesDelContrato = (): string[] =>
  Object.keys(esquema.definitions);
