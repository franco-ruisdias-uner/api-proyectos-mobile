import type { Ruta } from '../../../contract/types.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { RutaEntidad } from './route.entity.js';

/** Entidad → `Ruta` del PRD. `suministroIds` viene en el orden del recorrido (R4). */
export function aContrato(r: RutaEntidad, suministroIds: string[]): Ruta {
  return {
    id: r.id,
    numero: r.numero,
    nombre: r.nombre,
    bimestre: r.bimestre,
    lectorId: r.lectorId,
    suministroIds,
    estado: r.estado,
    descargadaEn: r.descargadaEn === null ? null : aIsoConZona(r.descargadaEn),
    cerradaEn: r.cerradaEn === null ? null : aIsoConZona(r.cerradaEn),
  };
}
