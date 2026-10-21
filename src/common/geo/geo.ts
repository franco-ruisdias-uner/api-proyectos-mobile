import type { Coordenadas } from '../../../contract/types.js';

const RADIO_TIERRA_METROS = 6_371_000;
const METROS_POR_GRADO_LATITUD = 111_320;

const aRadianes = (grados: number) => (grados * Math.PI) / 180;

/** Distancia en metros entre dos puntos (haversine). */
export function distanciaMetros(a: Coordenadas, b: Coordenadas): number {
  const dLat = aRadianes(b.latitud - a.latitud);
  const dLon = aRadianes(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.latitud)) * Math.cos(aRadianes(b.latitud)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_METROS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Caja {
  latitudMin: number;
  latitudMax: number;
  longitudMin: number;
  longitudMax: number;
}

/** Caja que contiene el círculo: prefiltro para la consulta con `Between`. */
export function cajaAlrededor(centro: Coordenadas, radioMetros: number): Caja {
  // Un margen del 1% para no perder puntos del borde por la aproximación.
  const dLat = (radioMetros * 1.01) / METROS_POR_GRADO_LATITUD;
  const dLon =
    (radioMetros * 1.01) /
    (METROS_POR_GRADO_LATITUD * Math.max(Math.cos(aRadianes(centro.latitud)), 0.01));
  return {
    latitudMin: centro.latitud - dLat,
    latitudMax: centro.latitud + dLat,
    longitudMin: centro.longitud - dLon,
    longitudMax: centro.longitud + dLon,
  };
}

/** Punto dentro de un polígono (ray casting). */
export function puntoEnPoligono(punto: Coordenadas, poligono: Coordenadas[]): boolean {
  let adentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    const cruza =
      a.latitud > punto.latitud !== b.latitud > punto.latitud &&
      punto.longitud <
        ((b.longitud - a.longitud) * (punto.latitud - a.latitud)) / (b.latitud - a.latitud) +
          a.longitud;
    if (cruza) adentro = !adentro;
  }
  return adentro;
}
