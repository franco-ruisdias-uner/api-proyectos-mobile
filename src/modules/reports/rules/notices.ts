// Textos de las push de reportes (Especificación §7). Funciones puras.
import type { EstadoReporte } from '../../../../contract/types.js';

export interface AvisoDeReporte {
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}

interface ReporteAvisado {
  id: string;
  codigo: string;
}

const FRASE_POR_ESTADO: Record<EstadoReporte, string> = {
  recibido: 'fue recibido',
  en_revision: 'está en revisión',
  asignado: 'fue asignado a una cuadrilla',
  resuelto: 'fue resuelto',
  rechazado: 'fue rechazado',
};

export function avisoDeEstado(
  reporte: ReporteAvisado,
  estado: EstadoReporte,
): AvisoDeReporte {
  return {
    titulo: 'Tu reporte cambió de estado',
    cuerpo: `Tu reporte ${reporte.codigo} ${FRASE_POR_ESTADO[estado]}.`,
    datos: {
      tipo: 'estado',
      reporteId: reporte.id,
      codigo: reporte.codigo,
      estado,
    },
  };
}

export function avisoDeAdhesion(
  reporte: ReporteAvisado,
  totalAdhesiones: number,
): AvisoDeReporte {
  return {
    titulo: 'Se sumaron a tu reporte',
    cuerpo: `Un vecino más se sumó a tu reporte ${reporte.codigo}. Ya son ${totalAdhesiones}.`,
    datos: { tipo: 'adhesion', reporteId: reporte.id, codigo: reporte.codigo },
  };
}
