import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv, type ValidateFunction } from 'ajv';

/**
 * Validación de contrato (AGENTS §10.3). El esquema sale de contrato/tipos.ts y contrato/api.ts
 * (`pnpm contrato:esquema`): todos los campos requeridos y ninguno de más.
 */
interface Esquema {
  definitions: Record<string, Record<string, unknown>>;
}

const esquema = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../contrato/esquema.json'), 'utf8'),
) as Esquema;

export type Definicion = keyof typeof esquema.definitions & string;
export const DEFINICIONES = Object.keys(esquema.definitions);

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema({ ...esquema, $id: 'contrato' });
const validadores = new Map<string, ValidateFunction>();

function validador(definicion: string): ValidateFunction {
  let v = validadores.get(definicion);
  if (!v) {
    if (!esquema.definitions[definicion])
      throw new Error(`No existe la definición «${definicion}» en contrato/esquema.json`);
    v = ajv.getSchema(`contrato#/definitions/${definicion}`);
    if (!v) throw new Error(`ajv no compiló ${definicion}`);
    validadores.set(definicion, v);
  }
  return v;
}

const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;
const PARECE_INSTANTE = /^\d{4}-\d{2}-\d{2}T/;

/** Recorre el dato junto con su esquema buscando lo que JSON Schema no ve. */
function revisarConvenciones(
  valor: unknown,
  esquemaDe: Record<string, unknown> | undefined,
  ruta: string,
  problemas: string[],
) {
  if (typeof valor === 'string') {
    if (PARECE_INSTANTE.test(valor) && !INSTANTE.test(valor)) {
      problemas.push(`${ruta}: el instante "${valor}" no tiene la forma AAAA-MM-DDTHH:MM:SS-03:00`);
    }
    return;
  }
  if (Array.isArray(valor)) {
    const items = esquemaDe?.items as Record<string, unknown> | undefined;
    valor.forEach((v, i) => revisarConvenciones(v, resolver(items), `${ruta}[${i}]`, problemas));
    return;
  }
  if (valor && typeof valor === 'object') {
    const propiedades = (esquemaDe?.properties ?? {}) as Record<string, Record<string, unknown>>;
    for (const [clave, v] of Object.entries(valor)) {
      const sub = resolver(propiedades[clave]);
      if ((clave === 'id' || clave.endsWith('Id')) && typeof v === 'number') {
        problemas.push(`${ruta}.${clave}: el id es un número; tiene que ser texto`);
      }
      const tipos = sub?.type;
      const admiteNull = Array.isArray(tipos)
        ? tipos.includes('null')
        : (sub?.anyOf as { type?: string }[] | undefined)?.some((s) => s.type === 'null');
      if (admiteNull && v === '') {
        problemas.push(`${ruta}.${clave}: viene "" donde corresponde null`);
      }
      revisarConvenciones(v, sub, `${ruta}.${clave}`, problemas);
    }
  }
}

function resolver(s: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const ref = s?.$ref as string | undefined;
  if (ref) return esquema.definitions[ref.replace('#/definitions/', '')];
  return s;
}

function validarContra(definicion: string, dato: unknown, ruta: string): string[] {
  const v = validador(definicion);
  const problemas: string[] = [];
  if (!v(dato)) {
    for (const e of v.errors ?? []) {
      problemas.push(
        `${ruta}${e.instancePath}: ${e.message}${e.params && 'additionalProperty' in e.params ? ` («${String(e.params.additionalProperty)}»)` : ''}`,
      );
    }
  }
  revisarConvenciones(dato, esquema.definitions[definicion], ruta, problemas);
  return problemas;
}

/**
 * Valida un cuerpo de éxito: el sobre (`datos` + `meta`) y cada elemento de `datos` contra la
 * definición pedida. Una lista lleva `meta` con total/pagina/porPagina; un recurso, `meta: null`.
 */
export function esperarContrato(cuerpo: unknown, definicion: Definicion): void {
  const problemas: string[] = [];
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    throw new Error(`La respuesta no es un objeto: ${JSON.stringify(cuerpo)}`);
  }
  const claves = Object.keys(cuerpo).sort();
  if (claves.join(',') !== 'datos,meta') {
    problemas.push(
      `el sobre tiene que tener exactamente datos y meta; tiene: ${claves.join(', ')}`,
    );
  }
  const { datos, meta } = cuerpo as { datos: unknown; meta: unknown };
  if (Array.isArray(datos)) {
    problemas.push(...validarContra('Meta', meta, 'meta'));
    datos.forEach((d, i) => problemas.push(...validarContra(definicion, d, `datos[${i}]`)));
  } else {
    if (meta !== null)
      problemas.push(`un solo recurso lleva meta: null; vino ${JSON.stringify(meta)}`);
    problemas.push(...validarContra(definicion, datos, 'datos'));
  }
  if (problemas.length > 0) {
    throw new Error(
      `La respuesta no cumple el contrato «${definicion}»:\n  - ${problemas.join('\n  - ')}\n${JSON.stringify(cuerpo, null, 2)}`,
    );
  }
}

/** Valida el sobre de error (sólo `codigo` y `mensaje`) y, si se pasa, el código. */
export function esperarError(cuerpo: unknown, codigo?: string): void {
  const problemas = validarContra('RespuestaError', cuerpo, 'cuerpo');
  if (problemas.length > 0) {
    throw new Error(
      `El error no tiene la forma { error: { codigo, mensaje } }:\n  - ${problemas.join('\n  - ')}\n${JSON.stringify(cuerpo)}`,
    );
  }
  const error = (cuerpo as { error: { codigo: string; mensaje: string } }).error;
  if (codigo !== undefined && error.codigo !== codigo) {
    throw new Error(`Se esperaba el código ${codigo} y vino ${error.codigo}: "${error.mensaje}"`);
  }
  if (error.mensaje.trim() === '') throw new Error('El mensaje de error está vacío');
}
