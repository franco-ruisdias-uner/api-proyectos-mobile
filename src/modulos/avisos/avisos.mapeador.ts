import type { Aviso } from '../../../contrato/tipos.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { AvisoEntidad } from './aviso.entidad.js';

/** Única salida de un aviso hacia el cliente. `lineaIds` ya viene en el orden en que se cargó. */
export function avisoAContrato(
  aviso: AvisoEntidad,
  lineaIds: string[],
  urlDeArchivo: (clave: string) => string,
): Aviso {
  return {
    id: aviso.id,
    titulo: aviso.titulo,
    detalle: aviso.detalle,
    lineaIds,
    desde: aIsoConZona(aviso.desde),
    hasta: aviso.hasta === null ? null : aIsoConZona(aviso.hasta),
    gravedad: aviso.gravedad,
    trazadoAlternativo:
      aviso.trazadoAlternativo?.map((p) => ({ latitud: p.latitud, longitud: p.longitud })) ?? null,
    videoUrl: aviso.videoClave === null ? null : urlDeArchivo(aviso.videoClave),
  };
}
