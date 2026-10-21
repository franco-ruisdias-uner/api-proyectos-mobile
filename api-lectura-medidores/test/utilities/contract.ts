import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv, type ValidateFunction } from 'ajv';
import { expect } from 'vitest';

// Valida que una respuesta tenga la forma exacta del contrato (AGENTS §10.3).

interface Esquema {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, Esquema>;
  items?: Esquema;
  anyOf?: Esquema[];
  enum?: unknown[];
}

const esquema = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../contract/schema.json'), 'utf8'),
) as { definitions: Record<string, Esquema> };

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(esquema, 'contract');
const validadores = new Map<string, ValidateFunction>();

function validador(nombre: string): ValidateFunction {
  let v = validadores.get(nombre);
  if (!v) {
    if (!esquema.definitions[nombre])
      throw new Error(`El contrato no tiene el tipo ${nombre}`);
    v = ajv.getSchema(`contract#/definitions/${nombre}`);
    if (!v) throw new Error(`No se pudo compilar ${nombre}`);
    validadores.set(nombre, v);
  }
  return v;
}

const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;
const PARECE_INSTANTE = /^\d{4}-\d{2}-\d{2}T/;

function resolver(e: Esquema): Esquema {
  if (e.$ref)
    return resolver(esquema.definitions[e.$ref.replace('#/definitions/', '')]);
  return e;
}

function admiteNull(e: Esquema): boolean {
  const r = resolver(e);
  if (Array.isArray(r.type)) return r.type.includes('null');
  if (r.type === 'null') return true;
  return (r.anyOf ?? []).some(admiteNull);
}

/** Reglas que el JSON Schema no expresa: instantes con -03:00, ids de texto, nada de "" en vez de null. */
function revisar(valor: unknown, e: Esquema | undefined, ruta: string): void {
  if (typeof valor === 'string' && PARECE_INSTANTE.test(valor)) {
    expect(
      valor,
      `${ruta}: los instantes van como AAAA-MM-DDTHH:MM:SS-03:00`,
    ).toMatch(INSTANTE);
  }
  if (Array.isArray(valor)) {
    const items = e ? resolver(e).items : undefined;
    valor.forEach((v, i) => revisar(v, items, `${ruta}[${i}]`));
    return;
  }
  if (typeof valor !== 'object' || valor === null) return;
  const propiedades = e ? (resolver(e).properties ?? {}) : {};
  for (const [clave, v] of Object.entries(valor)) {
    if (clave === 'id' || clave.endsWith('Id')) {
      expect(
        typeof v === 'string' || v === null,
        `${ruta}.${clave}: los ids son texto`,
      ).toBe(true);
    }
    const sub = propiedades[clave];
    if (v === '' && sub && admiteNull(sub)) {
      throw new Error(
        `${ruta}.${clave}: un campo sin valor va como null, no como ""`,
      );
    }
    revisar(v, sub, `${ruta}.${clave}`);
  }
}

function validar(nombre: string, dato: unknown, ruta: string): void {
  const v = validador(nombre);
  if (!v(dato)) {
    throw new Error(
      `${ruta} no cumple el contrato de ${nombre}:\n${ajv.errorsText(v.errors, { separator: '\n' })}\n` +
        JSON.stringify(dato, null, 2),
    );
  }
  revisar(dato, { $ref: `#/definitions/${nombre}` }, ruta);
}

/**
 * El cuerpo es `{ datos, meta }` y cada elemento de `datos` cumple el tipo `nombre`.
 * Si `datos` es una lista, `meta` es la paginación; si es un recurso, `meta` es null.
 */
export function esperarContrato(cuerpo: unknown, nombre: string): void {
  expect(cuerpo).toBeTypeOf('object');
  const c = cuerpo as Record<string, unknown>;
  expect(
    Object.keys(c).sort(),
    'el sobre tiene exactamente datos y meta',
  ).toEqual(['datos', 'meta']);
  if (Array.isArray(c.datos)) {
    validar('Meta', c.meta, 'meta');
    c.datos.forEach((d, i) => validar(nombre, d, `datos[${i}]`));
  } else {
    expect(c.meta, 'meta va en null en un solo recurso').toBeNull();
    validar(nombre, c.datos, 'datos');
  }
}

/** El cuerpo es exactamente `{ error: { codigo, mensaje } }`, con ese código si se indica. */
export function esperarError(cuerpo: unknown, codigo?: string): void {
  const c = cuerpo as Record<string, unknown>;
  expect(Object.keys(c ?? {}), 'el sobre de error tiene sólo "error"').toEqual([
    'error',
  ]);
  const error = c.error as Record<string, unknown>;
  expect(Object.keys(error).sort()).toEqual(['codigo', 'mensaje']);
  expect(error.codigo).toMatch(/^[A-Z][A-Z_]+$/);
  expect(typeof error.mensaje).toBe('string');
  expect((error.mensaje as string).length).toBeGreaterThan(0);
  if (codigo !== undefined) expect(error.codigo).toBe(codigo);
}

export const DEFINICIONES_DEL_CONTRATO = Object.keys(esquema.definitions);
