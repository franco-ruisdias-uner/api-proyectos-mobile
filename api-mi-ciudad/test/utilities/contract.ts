import { readFileSync } from 'node:fs';
import { Ajv, type ValidateFunction } from 'ajv';

type Esquema = {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, Esquema>;
  items?: Esquema;
  anyOf?: Esquema[];
  definitions?: Record<string, Esquema>;
};

const esquema = JSON.parse(
  readFileSync(new URL('../../contract/schema.json', import.meta.url), 'utf8'),
) as Esquema & { definitions: Record<string, Esquema> };

export type Definicion = keyof typeof esquema.definitions & string;

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(esquema, 'contract');
const validadores = new Map<string, ValidateFunction>();

function validador(nombre: string): ValidateFunction {
  let v = validadores.get(nombre);
  if (!v) {
    if (!esquema.definitions[nombre])
      throw new Error(`No hay una definición «${nombre}» en contract/schema.json`);
    v = ajv.compile({ $ref: `contract#/definitions/${nombre}` });
    validadores.set(nombre, v);
  }
  return v;
}

const META = { total: 'number', pagina: 'number', porPagina: 'number' };
const PARECE_INSTANTE = /^\d{4}-\d{2}-\d{2}T/;
const INSTANTE_DEL_CONTRATO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;

function resolver(e: Esquema): Esquema {
  return e.$ref ? resolver(esquema.definitions[e.$ref.replace('#/definitions/', '')]) : e;
}

function admiteNulo(e: Esquema): boolean {
  const r = resolver(e);
  if (Array.isArray(r.type) && r.type.includes('null')) return true;
  if (r.type === 'null') return true;
  return (r.anyOf ?? []).some(admiteNulo);
}

/** Revisa lo que JSON Schema no dice: fechas con -03:00 sin milisegundos, ids de texto, "" en vez de null. */
function revisarValores(valor: unknown, e: Esquema | undefined, ruta: string, problemas: string[]): void {
  if (typeof valor === 'string' && PARECE_INSTANTE.test(valor) && !INSTANTE_DEL_CONTRATO.test(valor)) {
    problemas.push(`${ruta}: la fecha "${valor}" no es AAAA-MM-DDTHH:MM:SS-03:00`);
  }
  if (Array.isArray(valor)) {
    const items = e ? resolver(e).items : undefined;
    valor.forEach((v, i) => revisarValores(v, items, `${ruta}[${i}]`, problemas));
    return;
  }
  if (valor && typeof valor === 'object') {
    const r = e ? resolver(e) : undefined;
    const opciones = r?.anyOf?.map(resolver).find((o) => o.properties) ?? r;
    for (const [clave, v] of Object.entries(valor)) {
      const hijo = opciones?.properties?.[clave];
      if ((clave === 'id' || clave.endsWith('Id')) && typeof v === 'number') {
        problemas.push(`${ruta}.${clave}: el id es un número`);
      }
      if (v === '' && hijo && admiteNulo(hijo)) {
        problemas.push(`${ruta}.${clave}: viene "" donde el tipo admite null`);
      }
      revisarValores(v, hijo, `${ruta}.${clave}`, problemas);
    }
  }
}

/**
 * Valida una respuesta de éxito contra el contrato: el sobre (`datos` + `meta`) y cada elemento
 * de `datos` contra la definición pedida de `contract/schema.json`.
 */
export function esperarContrato(cuerpo: unknown, definicion: string): void {
  const problemas: string[] = [];
  if (!cuerpo || typeof cuerpo !== 'object')
    throw new Error(`La respuesta no es un objeto: ${JSON.stringify(cuerpo)}`);
  const sobre = cuerpo as Record<string, unknown>;
  const claves = Object.keys(sobre).sort();
  if (claves.join(',') !== 'datos,meta')
    problemas.push(`el sobre tiene las claves [${claves}] en vez de [datos, meta]`);

  const esLista = Array.isArray(sobre.datos);
  if (esLista) {
    const meta = sobre.meta as Record<string, unknown> | null;
    if (!meta || typeof meta !== 'object') problemas.push('una lista tiene que traer meta');
    else {
      if (Object.keys(meta).sort().join(',') !== 'pagina,porPagina,total') {
        problemas.push(`meta tiene [${Object.keys(meta)}] en vez de [total, pagina, porPagina]`);
      }
      for (const [k, t] of Object.entries(META))
        if (typeof meta[k] !== t) problemas.push(`meta.${k} no es ${t}`);
    }
  } else if (sobre.meta !== null) {
    problemas.push('un solo recurso tiene que traer meta: null');
  }

  const v = validador(definicion);
  const elementos = esLista ? (sobre.datos as unknown[]) : [sobre.datos];
  elementos.forEach((dato, i) => {
    const ruta = esLista ? `datos[${i}]` : 'datos';
    if (!v(dato)) {
      for (const e of v.errors ?? [])
        problemas.push(`${ruta}${e.instancePath}: ${e.message} ${JSON.stringify(e.params)}`);
    }
    revisarValores(dato, esquema.definitions[definicion], ruta, problemas);
  });

  if (problemas.length > 0) {
    throw new Error(
      `La respuesta no cumple el contrato «${definicion}»:\n  - ${problemas.join('\n  - ')}\n${JSON.stringify(cuerpo, null, 2).slice(0, 2000)}`,
    );
  }
}

/** Valida el sobre de error: exactamente `{ error: { codigo, mensaje } }`, con el código esperado. */
export function esperarError(
  respuesta: { status: number; body: unknown },
  estado: number,
  codigo: string,
): void {
  const v = validador('RespuestaError');
  if (!v(respuesta.body)) {
    throw new Error(
      `El error no tiene la forma { error: { codigo, mensaje } }: ${JSON.stringify(respuesta.body)}`,
    );
  }
  const { error } = respuesta.body as { error: { codigo: string; mensaje: string } };
  expect({ estado: respuesta.status, codigo: error.codigo }).toEqual({ estado, codigo });
  expect(error.mensaje.length).toBeGreaterThan(0);
  // Mensajes para mostrar en pantalla: nada técnico.
  expect(error.mensaje).not.toMatch(/Exception|Error:|SQL|undefined|null|stack|\bmust\b|Cannot /);
}

export const DEFINICIONES = Object.keys(esquema.definitions);
