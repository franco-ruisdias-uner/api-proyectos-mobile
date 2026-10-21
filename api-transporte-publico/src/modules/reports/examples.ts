import type { ResumenDemoras } from '../../../contract/api.js';
import type { ReporteDeDemora } from '../../../contract/types.js';

export const REPORTE_DE_EJEMPLO: ReporteDeDemora = {
  id: 'rep-3390',
  lineaId: 'lin-05',
  paradaId: 'par-101',
  usuarioId: 'usr-320',
  motivo: 'demorado',
  comentario: 'Hace veinte minutos que espero y no pasa.',
  fotoUri: null,
  confirmaciones: 2,
  fechaHora: '2026-09-30T14:05:00-03:00',
  sincronizado: true,
};

export const RESUMEN_DE_EJEMPLO: ResumenDemoras = {
  lineaId: 'lin-05',
  paradaId: null,
  cantidad: 4,
  confirmaciones: 7,
  ultimo: '2026-09-30T14:05:00-03:00',
};
