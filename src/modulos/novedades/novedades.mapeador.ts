import type { Novedad } from '../../../contrato/tipos.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { NovedadEntidad } from './novedad.entidad.js';

/** Entidad → `Novedad` del PRD. `urlDeArchivo` hace absolutas las claves de la foto y la nota de voz. */
export function aContrato(
  n: NovedadEntidad,
  urlDeArchivo: (clave: string) => string,
): Novedad {
  return {
    id: n.id,
    rutaId: n.rutaId,
    suministroId: n.suministroId,
    lectorId: n.lectorId,
    motivo: n.motivo,
    comentario: n.comentario,
    audioUri: n.audioClave === null ? null : urlDeArchivo(n.audioClave),
    fotoUri: urlDeArchivo(n.fotoClave),
    fechaHora: aIsoConZona(n.fechaHora),
    sincronizada: true,
  };
}
