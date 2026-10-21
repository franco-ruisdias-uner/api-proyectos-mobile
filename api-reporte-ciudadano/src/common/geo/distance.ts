// Distancias (AGENTS §5.5): nada geoespacial en la base. Prefiltro por caja en la consulta y
// haversine acá.
import type { Coordenadas } from '../../../contract/types.js';

const RADIO_TIERRA_M = 6_371_008.8;
const METROS_POR_GRADO = (Math.PI / 180) * RADIO_TIERRA_M;
const aRadianes = (grados: number) => (grados * Math.PI) / 180;

export interface Caja {
  norte: number;
  sur: number;
  este: number;
  oeste: number;
}

/** Distancia en metros sobre la esfera entre dos puntos. */
export function distanciaEnMetros(a: Coordenadas, b: Coordenadas): number {
  const dLat = aRadianes(b.latitud - a.latitud);
  const dLon = aRadianes(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.latitud)) *
      Math.cos(aRadianes(b.latitud)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Caja que contiene todos los puntos a `radioMetros` o menos de `centro` (con un margen chico). */
export function cajaAlrededorDe(
  centro: Coordenadas,
  radioMetros: number,
): Caja {
  const margen = 1.001;
  const dLat = (radioMetros / METROS_POR_GRADO) * margen;
  const coseno = Math.max(0.0001, Math.cos(aRadianes(centro.latitud)));
  const dLon = (radioMetros / (METROS_POR_GRADO * coseno)) * margen;
  return {
    norte: centro.latitud + dLat,
    sur: centro.latitud - dLat,
    este: centro.longitud + dLon,
    oeste: centro.longitud - dLon,
  };
}
