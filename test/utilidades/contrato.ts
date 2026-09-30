import { readFileSync } from 'node:fs';
import { Ajv, type ValidateFunction } from 'ajv';

// Validación de las respuestas contra contrato/esquema.json (AGENTS §10.3).

const esquema = JSON.parse(
  readFileSync(new URL('../../contrato/esquema.json', import.meta.url), 'utf8'),
) as { definitions: Record<string, unknown> };

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(esquema, 'contrato');

const cache = new Map<string, ValidateFunction>();
function validador(definicion: string): ValidateFunction {
  if (!(definicion in esquema.definitions)) {
    throw new Error(`"${definicion}" no está en contrato/esquema.json`);
  }
  let v = cache.get(definicion);
  if (!v) {
    v = ajv.compile({ $ref: `contrato#/definitions/${definicion}` });
    cache.set(definicion, v);
  }
  return v;
}

export type NombreDeDefinicion = keyof typeof esquema.definitions & string;

const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;
const PARECE_FECHA_Y_HORA = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

function revisarValores(valor: unknown, ruta: string, problemas: string[]): void {
  if (typeof valor === 'string') {
    if (PARECE_FECHA_Y_HORA.test(valor) && !INSTANTE.test(valor)) {
      problemas.push(`${ruta}: "${valor}" no tiene la forma AAAA-MM-DDTHH:MM:SS-03:00`);
    }
    if (valor === '') problemas.push(`${ruta}: string vacío (tiene que ser null)`);
    return;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => revisarValores(v, `${ruta}[${i}]`, problemas));
    return;
  }
  if (typeof valor === 'object' && valor !== null) {
    for (const [clave, v] of Object.entries(valor)) {
      if (/(^id$|Id$|Ids$)/.test(clave)) {
        const ids = Array.isArray(v) ? v : [v];
        for (const id of ids) {
          if (id !== null && typeof id !== 'string') {
            problemas.push(`${ruta}.${clave}: el id no es texto (${JSON.stringify(id)})`);
          }
        }
      }
      revisarValores(v, `${ruta}.${clave}`, problemas);
    }
  }
}

function fallar(problemas: string[], cuerpo: unknown): never {
  throw new Error(
    `La respuesta no cumple el contrato:\n  - ${problemas.join('\n  - ')}\n` +
      `Cuerpo: ${JSON.stringify(cuerpo, null, 2).slice(0, 2000)}`,
  );
}

/**
 * Valida el cuerpo de una respuesta de éxito: el sobre ({ datos, meta }), cada elemento de
 * datos contra la definición pedida, instantes con -03:00, ids de texto y nada de "".
 */
export function esperarContrato(cuerpo: unknown, definicion: NombreDeDefinicion): void {
  const problemas: string[] = [];
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    fallar(['el cuerpo no es un objeto'], cuerpo);
  }
  const claves = Object.keys(cuerpo).sort();
  if (claves.join(',') !== 'datos,meta') {
    fallar(
      [`el sobre tiene que tener exactamente datos y meta (tiene: ${claves.join(', ')})`],
      cuerpo,
    );
  }
  const { datos, meta } = cuerpo as { datos: unknown; meta: unknown };
  const validar = validador(definicion);

  if (Array.isArray(datos)) {
    if (!validador('Meta')(meta)) problemas.push(`meta no es un Meta: ${JSON.stringify(meta)}`);
    datos.forEach((dato, i) => {
      if (!validar(dato)) problemas.push(`datos[${i}]: ${ajv.errorsText(validar.errors)}`);
    });
  } else {
    if (meta !== null)
      problemas.push(`meta tiene que ser null en un recurso solo (vale ${JSON.stringify(meta)})`);
    if (!validar(datos)) problemas.push(`datos: ${ajv.errorsText(validar.errors)}`);
  }
  revisarValores(datos, 'datos', problemas);
  if (problemas.length > 0) fallar(problemas, cuerpo);
}

/** Valida una respuesta de error: { error: { codigo, mensaje } } y nada más. */
export function esperarError(
  respuesta: { status: number; body: unknown },
  estado: number,
  codigo: string,
): void {
  const problemas: string[] = [];
  if (respuesta.status !== estado)
    problemas.push(`estado ${respuesta.status}, se esperaba ${estado}`);
  if (!validador('RespuestaError')(respuesta.body)) {
    problemas.push(
      `no es un RespuestaError: ${ajv.errorsText(validador('RespuestaError').errors)}`,
    );
  } else {
    const { error } = respuesta.body as { error: { codigo: string; mensaje: string } };
    if (error.codigo !== codigo) problemas.push(`código ${error.codigo}, se esperaba ${codigo}`);
    if (error.mensaje.trim() === '') problemas.push('el mensaje está vacío');
  }
  if (problemas.length > 0) fallar(problemas, respuesta.body);
}
