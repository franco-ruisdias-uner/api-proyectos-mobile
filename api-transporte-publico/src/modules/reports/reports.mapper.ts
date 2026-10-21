import type { ResumenDemoras } from '../../../contract/api.js';
import type { ReporteDeDemora } from '../../../contract/types.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { ReporteDemoraEntidad } from './delay-report.entity.js';
import type { GrupoDeReportes } from './rules/summary.js';

/** Única salida de un reporte hacia el cliente. Si está en el servidor, está sincronizado. */
export function reporteAContrato(
  reporte: ReporteDemoraEntidad,
  urlDeArchivo: (clave: string) => string,
): ReporteDeDemora {
  return {
    id: reporte.id,
    lineaId: reporte.lineaId,
    paradaId: reporte.paradaId,
    usuarioId: reporte.usuarioId,
    motivo: reporte.motivo,
    comentario: reporte.comentario,
    fotoUri: reporte.fotoClave === null ? null : urlDeArchivo(reporte.fotoClave),
    confirmaciones: reporte.confirmaciones,
    fechaHora: aIsoConZona(reporte.fechaHora),
    sincronizado: true,
  };
}

export function resumenAContrato(grupo: GrupoDeReportes): ResumenDemoras {
  return {
    lineaId: grupo.lineaId,
    paradaId: grupo.paradaId,
    cantidad: grupo.cantidad,
    confirmaciones: grupo.confirmaciones,
    ultimo: aIsoConZona(grupo.ultimo),
  };
}
