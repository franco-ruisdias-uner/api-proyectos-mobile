// Textos de las push de reportes (Especificación §7). Funciones puras.
import type { EstadoReporte } from '../../../../contract/types.js';

export interface AvisoDeReporte {
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
  /** Canal de Android donde la app lo muestra. */
  canal: string;
}

export interface ReporteAvisado {
  id: string;
  codigo: string;
  /** Nombre del tipo de reporte, p. ej. «Bache». */
  tipo: string;
  direccion: string;
}

export const CANAL_ESTADO = 'estado';
export const CANAL_ADHESION = 'adhesion';
export const CANAL_NUEVO_REPORTE = 'nuevo-reporte';

const FRASE_POR_ESTADO: Record<EstadoReporte, string> = {
  recibido: 'fue recibido',
  en_revision: 'está en revisión',
  asignado: 'fue asignado a una cuadrilla',
  resuelto: 'fue resuelto',
  rechazado: 'fue rechazado',
};

const descripcion = (r: ReporteAvisado) => `${r.tipo} en ${r.direccion}`;

export function avisoDeEstado(
  reporte: ReporteAvisado,
  estado: EstadoReporte,
): AvisoDeReporte {
  return {
    titulo: 'Tu reporte cambió de estado',
    cuerpo: `Tu reporte ${descripcion(reporte)} ${FRASE_POR_ESTADO[estado]}.`,
    datos: {
      tipo: 'estado',
      reporteId: reporte.id,
      codigo: reporte.codigo,
      estado,
    },
    canal: CANAL_ESTADO,
  };
}

export function avisoDeAdhesion(
  reporte: ReporteAvisado,
  totalAdhesiones: number,
): AvisoDeReporte {
  return {
    titulo: 'Se sumaron a tu reporte',
    cuerpo: `Un vecino más se sumó a tu reporte ${descripcion(reporte)}. Ya son ${totalAdhesiones}.`,
    datos: { tipo: 'adhesion', reporteId: reporte.id, codigo: reporte.codigo },
    canal: CANAL_ADHESION,
  };
}

/** Reporte nuevo: lo reciben los operadores. */
export function avisoDeReporteNuevo(reporte: ReporteAvisado): AvisoDeReporte {
  return {
    titulo: 'Nuevo reporte',
    cuerpo: `Nuevo reporte: ${descripcion(reporte)}`,
    datos: { tipo: 'nuevo', reporteId: reporte.id, codigo: reporte.codigo },
    canal: CANAL_NUEVO_REPORTE,
  };
}
