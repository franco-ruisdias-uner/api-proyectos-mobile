import type { Coordenadas } from '../../../contract/types.js';

const RADIO_TIERRA_METROS = 6_371_000;
const METROS_POR_GRADO_DE_LATITUD = 111_320;
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
  latitudMinima: number;
  latitudMaxima: number;
  longitudMinima: number;
  longitudMaxima: number;
}

/** Caja que contiene el círculo: sirve de prefiltro con Between en la consulta. */
export function cajaAlrededor(centro: Coordenadas, radioMetros: number): Caja {
  const dLat = radioMetros / METROS_POR_GRADO_DE_LATITUD;
  const cosLat = Math.max(Math.cos(aRadianes(centro.latitud)), 0.01);
  const dLon = radioMetros / (METROS_POR_GRADO_DE_LATITUD * cosLat);
  return {
    latitudMinima: centro.latitud - dLat,
    latitudMaxima: centro.latitud + dLat,
    longitudMinima: centro.longitud - dLon,
    longitudMaxima: centro.longitud + dLon,
  };
}

/** Punto dentro de polígono (ray casting). */
export function puntoEnPoligono(punto: Coordenadas, poligono: Coordenadas[]): boolean {
  if (poligono.length < 3) return false;
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
