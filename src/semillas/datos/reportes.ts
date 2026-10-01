import type { MotivoDemora } from '../../../contrato/tipos.js';
import { CLAVE_DE_LA_FOTO_DE_DEMO } from '../medios/foto-de-demo.js';

export interface ReporteSemilla {
  id: string;
  lineaId: string;
  paradaId: string;
  usuarioId: string;
  motivo: MotivoDemora;
  comentario: string | null;
  fotoClave: string | null;
  fechaHora: Date;
  /** Quiénes lo confirmaron; `confirmaciones` sale de acá. */
  confirmaronIds: string[];
}

const MINUTO = 60_000;

/**
 * Reportes de demora de demo, relativos a `ahora` (el reloj de la API): tres recientes en par-101
 * (uno con dos confirmaciones y uno sin ninguna, que Julián puede confirmar) y uno viejo, que ya
 * no se muestra ni se puede confirmar. El resto de las paradas no tiene reportes (lista vacía).
 */
export function reportesDeDemo(ahora: Date): ReporteSemilla[] {
  const hace = (minutos: number) =>
    new Date(Math.floor((ahora.getTime() - minutos * MINUTO) / 1000) * 1000);
  const base = { paradaId: 'par-101', fotoClave: null };
  return [
    // Del PRD, con su id exacto.
    {
      ...base,
      id: 'rep-3390',
      lineaId: 'lin-05',
      usuarioId: 'usr-320',
      motivo: 'no_paso',
      comentario: 'Hace 25 minutos que espero',
      fechaHora: hace(25),
      confirmaronIds: ['usr-nuevo', 'usr-direccion'],
    },
    {
      ...base,
      id: 'rep-3391',
      lineaId: 'lin-14',
      usuarioId: 'usr-320',
      motivo: 'paso_lleno',
      comentario: null,
      fechaHora: hace(50),
      confirmaronIds: ['usr-nuevo'],
    },
    {
      ...base,
      id: 'rep-3392',
      lineaId: 'lin-05',
      usuarioId: 'usr-nuevo',
      motivo: 'calle_cortada',
      comentario: 'Hay un corte en la calle y el colectivo da la vuelta.',
      fechaHora: hace(10),
      confirmaronIds: [],
    },
    // Con foto (la subida por el puerto de archivos la hace `sembrar`).
    {
      ...base,
      id: 'rep-3394',
      lineaId: 'lin-14',
      usuarioId: 'usr-nuevo',
      motivo: 'unidad_rota',
      comentario: 'Una unidad quedó parada en la esquina.',
      fotoClave: CLAVE_DE_LA_FOTO_DE_DEMO,
      fechaHora: hace(5),
      confirmaronIds: [],
    },
    // Viejo: pasó el plazo de 90 minutos.
    {
      ...base,
      id: 'rep-3393',
      lineaId: 'lin-05',
      usuarioId: 'usr-320',
      motivo: 'no_paso',
      comentario: null,
      fechaHora: hace(5 * 60),
      confirmaronIds: ['usr-nuevo'],
    },
  ];
}
