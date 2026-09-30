import type { Linea, Parada } from '../../../contrato/tipos.js';
import type { LineaEntidad } from './linea.entidad.js';
import type { ParadaEntidad } from './parada.entidad.js';
import type { RecorridoEntidad } from './recorrido.entidad.js';

/** Única salida de una línea hacia el cliente. `paradaIds` ya viene en orden de paso. */
export function lineaAContrato(
  linea: LineaEntidad,
  recorridos: { recorrido: RecorridoEntidad; paradaIds: string[] }[],
): Linea {
  return {
    id: linea.id,
    numero: linea.numero,
    nombre: linea.nombre,
    color: linea.color,
    empresa: linea.empresa,
    recorridos: recorridos.map(({ recorrido, paradaIds }) => ({
      sentido: recorrido.sentido,
      destino: recorrido.destino,
      trazado: recorrido.trazado.map((p) => ({ latitud: p.latitud, longitud: p.longitud })),
      paradaIds,
    })),
    activa: linea.activa,
  };
}

/** Única salida de una parada. `lineaIds` se calcula desde los recorridos (R2). */
export function paradaAContrato(parada: ParadaEntidad, lineaIds: string[]): Parada {
  return {
    id: parada.id,
    nombre: parada.nombre,
    coordenadas: { latitud: parada.latitud, longitud: parada.longitud },
    lineaIds,
    sentido: parada.sentido,
    refugio: parada.refugio,
    codigoQr: parada.codigoQr,
  };
}
