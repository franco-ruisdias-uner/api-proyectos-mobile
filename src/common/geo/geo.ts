import type { Coordenadas } from '../../../contract/types.js';

const RADIO_TIERRA_METROS = 6_371_000;
const aRadianes = (grados: number) => (grados * Math.PI) / 180;

/** Distancia en metros entre dos puntos (haversine). */
export function distanciaMetros(a: Coordenadas, b: Coordenadas): number {
  const dLat = aRadianes(b.latitud - a.latitud);
  const dLng = aRadianes(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.latitud)) * Math.cos(aRadianes(b.latitud)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_METROS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Caja {
  latitudMin: number;
  latitudMax: number;
  longitudMin: number;
  longitudMax: number;
}

/** Caja que contiene el círculo de `radioMetros`; sirve para prefiltrar con `Between`. */
export function cajaAlrededor(centro: Coordenadas, radioMetros: number): Caja {
  const dLat = (radioMetros / RADIO_TIERRA_METROS) * (180 / Math.PI);
  const coseno = Math.max(Math.cos(aRadianes(centro.latitud)), 1e-6);
  const dLng = Math.min(180, dLat / coseno);
  return {
    latitudMin: centro.latitud - dLat,
    latitudMax: centro.latitud + dLat,
    longitudMin: centro.longitud - dLng,
    longitudMax: centro.longitud + dLng,
  };
}

/**
 * ¿La caja se pasa de ±180 de longitud (cruza el antimeridiano) o de ±90 de latitud (el círculo
 * contiene un polo, y con él todas las longitudes)? En ese caso un `Between` sobre la longitud
 * dejaría afuera lugares que están dentro del radio.
 */
export function cruzaElAntimeridianoOUnPolo(caja: Caja): boolean {
  return caja.longitudMin < -180 || caja.longitudMax > 180 || caja.latitudMin < -90 || caja.latitudMax > 90;
}

/** Punto dentro de polígono (ray casting). */
export function puntoEnPoligono(punto: Coordenadas, poligono: Coordenadas[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    const cruza =
      a.latitud > punto.latitud !== b.latitud > punto.latitud &&
      punto.longitud <
        ((b.longitud - a.longitud) * (punto.latitud - a.latitud)) / (b.latitud - a.latitud) + a.longitud;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}
