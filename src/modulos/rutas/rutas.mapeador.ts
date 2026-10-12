import type { Ruta } from '../../../contrato/tipos.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { RutaEntidad } from './ruta.entidad.js';

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
