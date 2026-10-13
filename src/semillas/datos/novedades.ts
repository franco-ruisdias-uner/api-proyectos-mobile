import type { MotivoNovedad } from '../../../contrato/tipos.js';
import { MOTIVOS_NOVEDAD } from '../../modulos/novedades/reglas/novedades.js';
import { LECTOR_DE_BRASIL, RUTA_DE_BRASIL } from './lecturas.js';
import type { SemillaSuministro } from './suministros.js';

// Las novedades de la app de clase (docs/referencia/app-de-clase/mocks/incidents.ts), todas de la
// ruta 07 de Brasil y del lector usr-011: veinte, en los suministros que no tienen lectura, con
// los siete motivos. `nov-3312` es la del PRD (`sum-004150`, perro suelto, con nota de voz).

/** Novedades de Brasil por posición en la ruta. */
export const INDICES_CON_NOVEDAD = [
  2, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42,
];
const INDICE_DEL_PRD = 2;

const COMENTARIOS: Record<MotivoNovedad, string> = {
  perro_suelto: 'Dos perros grandes sueltos',
  porton_cerrado: 'El portón está con candado',
  pasto_alto: 'No se llega al medidor',
  medidor_tapado: 'Hay un mueble adelante',
  medidor_roto: 'El visor está roto',
  deshabitada: 'La casa está vacía',
  no_se_encuentra: 'No aparece en el frente',
};

export interface SemillaNovedad {
  id: string;
  rutaId: string;
  suministroId: string;
  lectorId: string;
  motivo: MotivoNovedad;
  comentario: string | null;
  /** La novedad del PRD lleva nota de voz. */
  conAudio: boolean;
  fechaHora: Date;
}

function reloj(minutosTotales: number): Date {
  const hh = String(8 + Math.floor(minutosTotales / 60)).padStart(2, '0');
  const mm = String(minutosTotales % 60).padStart(2, '0');
  return new Date(`2026-09-15T${hh}:${mm}:00-03:00`);
}

export function generarNovedades(
  suministros: SemillaSuministro[],
): SemillaNovedad[] {
  return INDICES_CON_NOVEDAD.map((indice) => {
    const delPrd = indice === INDICE_DEL_PRD;
    const motivo = delPrd
      ? 'perro_suelto'
      : MOTIVOS_NOVEDAD[indice % MOTIVOS_NOVEDAD.length];
    return {
      id: delPrd ? 'nov-3312' : `nov-${3300 + indice}`,
      rutaId: RUTA_DE_BRASIL,
      suministroId: suministros[indice].id,
      lectorId: LECTOR_DE_BRASIL,
      motivo,
      comentario: !delPrd && indice % 2 === 0 ? COMENTARIOS[motivo] : null,
      conAudio: delPrd,
      fechaHora: delPrd
        ? new Date('2026-09-15T08:31:00-03:00')
        : reloj(indice + 5),
    };
  });
}
