// Punto dentro de polígono (AGENTS §5.5): nada geoespacial en la base, se resuelve acá.
import type { Coordenadas } from '../../../contract/types.js';

const EPSILON = 1e-12;

/** ¿El punto `p` está sobre el segmento a–b? */
function sobreSegmento(
  p: Coordenadas,
  a: Coordenadas,
  b: Coordenadas,
): boolean {
  const cruz =
    (b.longitud - a.longitud) * (p.latitud - a.latitud) -
    (b.latitud - a.latitud) * (p.longitud - a.longitud);
  if (Math.abs(cruz) > EPSILON) return false;
  return (
    p.latitud >= Math.min(a.latitud, b.latitud) - EPSILON &&
    p.latitud <= Math.max(a.latitud, b.latitud) + EPSILON &&
    p.longitud >= Math.min(a.longitud, b.longitud) - EPSILON &&
    p.longitud <= Math.max(a.longitud, b.longitud) + EPSILON
  );
}

/**
 * Trazado de rayo (par-impar). Un punto sobre el borde o un vértice cuenta como adentro.
 * El polígono no repite el primer punto al final; con menos de tres puntos no contiene nada.
 */
export function puntoEnPoligono(
  punto: Coordenadas,
  poligono: readonly Coordenadas[],
): boolean {
  if (poligono.length < 3) return false;
  let adentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    if (sobreSegmento(punto, a, b)) return true;
    const cruza =
      a.latitud > punto.latitud !== b.latitud > punto.latitud &&
      punto.longitud <
        ((b.longitud - a.longitud) * (punto.latitud - a.latitud)) /
          (b.latitud - a.latitud) +
          a.longitud;
    if (cruza) adentro = !adentro;
  }
  return adentro;
}
