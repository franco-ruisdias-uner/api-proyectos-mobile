import type { Coordenadas } from '../../../../contrato/tipos.js';
import { distanciaMetros } from '../../../comun/geo/geo.js';

export interface ParadaOrdenable {
  id: string;
  nombreBusqueda: string;
  latitud: number;
  longitud: number;
}

export interface CriterioDeParadas {
  orden: 'nombre' | 'distancia';
  centro?: Coordenadas;
  radioMetros?: number;
}

const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Filtra por radio (si hay centro y radio) y ordena por nombre o por distancia. Se hace acá,
 * y no con ORDER BY, porque el orden de textos depende del motor (AGENTS §5.5); la distancia
 * se usa para ordenar y filtrar pero no sale en la respuesta (AGENTS §4.5).
 */
export function seleccionarParadas<T extends ParadaOrdenable>(
  paradas: readonly T[],
  criterio: CriterioDeParadas,
): T[] {
  const { centro, radioMetros, orden } = criterio;
  const conDistancia = paradas.map((parada) => ({
    parada,
    distancia: centro
      ? distanciaMetros(centro, { latitud: parada.latitud, longitud: parada.longitud })
      : 0,
  }));
  const dentro =
    centro && radioMetros !== undefined
      ? conDistancia.filter((x) => x.distancia <= radioMetros)
      : conDistancia;
  dentro.sort((x, y) =>
    orden === 'distancia'
      ? x.distancia - y.distancia || comparar(x.parada.id, y.parada.id)
      : comparar(x.parada.nombreBusqueda, y.parada.nombreBusqueda) ||
        comparar(x.parada.id, y.parada.id),
  );
  return dentro.map((x) => x.parada);
}
