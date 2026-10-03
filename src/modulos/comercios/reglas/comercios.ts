import type { Coordenadas, Horario } from '../../../../contrato/tipos.js';
import { distanciaMetros } from '../../../comun/geo/geo.js';

const PREFIJO_QR = 'CCU:';
const ID_DE_COMERCIO = /^com-[A-Za-z0-9_-]{3,36}$/;

export const ORDENES_COMERCIOS = ['nombre', 'distancia', 'puntaje'] as const;
export type OrdenComercios = (typeof ORDENES_COMERCIOS)[number];

/** D13: el código del QR de un comercio es `CCU:<comercioId>`. */
export const codigoQrDe = (comercioId: string): string => `${PREFIJO_QR}${comercioId}`;

/** El id de comercio que lleva un QR, o `null` si el texto no es de un comercio (R16). */
export function comercioIdDeQr(codigo: string): string | null {
  if (!codigo.startsWith(PREFIJO_QR)) return null;
  const id = codigo.slice(PREFIJO_QR.length);
  return ID_DE_COMERCIO.test(id) ? id : null;
}

export const esIdDeComercio = (id: string): boolean => ID_DE_COMERCIO.test(id);

export interface ComercioOrdenable {
  id: string;
  nombreBusqueda: string;
  puntaje: number;
  latitud: number;
  longitud: number;
}

const comparar = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const porNombreYId = (a: ComercioOrdenable, b: ComercioOrdenable): number =>
  comparar(a.nombreBusqueda, b.nombreBusqueda) || comparar(a.id, b.id);

/** Orden determinístico: el pedido y, si empata, nombre y después id (AGENTS §4.2). */
export function ordenarComercios<T extends ComercioOrdenable>(
  lista: readonly T[],
  orden: OrdenComercios,
  centro: Coordenadas | null,
): T[] {
  if (orden === 'puntaje') {
    return [...lista].sort((a, b) => b.puntaje - a.puntaje || porNombreYId(a, b));
  }
  if (orden === 'distancia' && centro) {
    const distancias = new Map(
      lista.map((c) => [
        c.id,
        distanciaMetros(centro, { latitud: c.latitud, longitud: c.longitud }),
      ]),
    );
    return [...lista].sort(
      (a, b) => distancias.get(a.id)! - distancias.get(b.id)! || porNombreYId(a, b),
    );
  }
  return [...lista].sort(porNombreYId);
}

/**
 * D2: mientras dura el cierre por vacaciones (hasta `cerradoHasta` inclusive) los horarios
 * salen vacíos y el teléfono lo ve cerrado. `hoy` es "AAAA-MM-DD" en Buenos Aires.
 */
export function horariosVisibles(
  horarios: Horario[],
  cerradoHasta: string | null,
  hoy: string,
): Horario[] {
  return cerradoHasta !== null && hoy <= cerradoHasta ? [] : horarios;
}
