import type { Coordenadas } from '../../../../contract/types.js';
import { distanciaMetros } from '../../../common/geo/geo.js';
import { normalizarBusqueda } from '../../../common/text/text.js';

export type OrdenLugares = 'nombre' | 'distancia';

/** Lo mínimo de un lugar para filtrar por radio y ordenar, sin traer las descripciones. */
export interface FilaLugar {
  id: string;
  nombreBusqueda: string;
  latitud: number;
  longitud: number;
}

/** R5: combinaciones de filtros que no tienen sentido. `null` si están bien. */
export function problemaDeFiltros(f: {
  latitud?: number;
  longitud?: number;
  radioMetros?: number;
  orden?: OrdenLugares;
}): string | null {
  const conLatitud = f.latitud !== undefined;
  const conLongitud = f.longitud !== undefined;
  if (conLatitud !== conLongitud) return 'Mandá la latitud y la longitud juntas.';
  if (f.orden === 'distancia' && !conLatitud) {
    return 'Para ordenar por distancia hace falta tu ubicación (latitud y longitud).';
  }
  if (f.radioMetros !== undefined && !conLatitud) {
    return 'Para buscar cerca hace falta tu ubicación (latitud y longitud).';
  }
  return null;
}

/**
 * El término de `q`, normalizado igual que la columna `nombreBusqueda`. Vacío: no filtra.
 * Los caracteres de control cuentan como espacios (un byte nulo, además, rompe en PostgreSQL).
 */
export function terminoDeBusqueda(q: string): string {
  // eslint-disable-next-line no-control-regex
  return normalizarBusqueda(q.replace(/[\u0000-\u001f\u007f]/g, ' '));
}

/**
 * Patrón para `Like`. `%`, `_` y `\` son comodines o escapes (y cada motor escapa distinto),
 * así que se reemplazan por `%`: la base trae de más y `coincideBusqueda` filtra lo exacto.
 */
export function patronLike(termino: string): string {
  return `%${termino.replace(/[%_\\]/g, '%')}%`;
}

export function coincideBusqueda(nombreBusqueda: string, termino: string): boolean {
  return nombreBusqueda.includes(termino);
}

/**
 * Filtra por radio y ordena en TypeScript (AGENTS §5.5): igual en los cuatro motores, que
 * ordenan texto cada uno con su intercalación. Desempate siempre por nombre y por id (§4.2).
 */
export function ordenarLugares<T extends FilaLugar>(
  filas: T[],
  opciones: { orden: OrdenLugares; punto?: Coordenadas; radioMetros?: number },
): T[] {
  const { orden, punto, radioMetros } = opciones;
  const conDistancia = filas.map((fila) => ({
    fila,
    distancia: punto ? distanciaMetros(punto, fila) : 0,
  }));
  const dentro =
    punto && radioMetros !== undefined
      ? conDistancia.filter((x) => x.distancia <= radioMetros)
      : conDistancia;
  return dentro
    .sort(
      (a, b) =>
        (orden === 'distancia' ? a.distancia - b.distancia : 0) ||
        comparar(a.fila.nombreBusqueda, b.fila.nombreBusqueda) ||
        comparar(a.fila.id, b.fila.id),
    )
    .map((x) => x.fila);
}

const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
