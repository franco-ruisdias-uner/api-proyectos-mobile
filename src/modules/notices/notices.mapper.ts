import type { Aviso } from '../../../contract/types.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { AvisoEntidad } from './notice.entity.js';

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
