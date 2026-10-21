import type { MotivoNovedad } from '../../../../contract/types.js';
import type { ResumenNovedades } from '../../../../contract/api.js';
import { diaEnArgentina } from '../../../common/dates/dates.js';

export const MOTIVOS_NOVEDAD: MotivoNovedad[] = [
  'perro_suelto',
  'porton_cerrado',
  'pasto_alto',
  'medidor_tapado',
  'medidor_roto',
  'deshabitada',
  'no_se_encuentra',
];

/** R19: novedades agrupadas por motivo y zona; por cantidad descendente, después motivo y zona. */
export function resumirNovedades(
  novedades: { motivo: MotivoNovedad; zona: string }[],
): ResumenNovedades[] {
  const grupos = new Map<string, ResumenNovedades>();
  for (const { motivo, zona } of novedades) {
    const clave = `${motivo}\u0000${zona}`;
    const g = grupos.get(clave);
    if (g) g.cantidad += 1;
    else grupos.set(clave, { motivo, zona, cantidad: 1 });
  }
  return [...grupos.values()].sort(
    (a, b) =>
      b.cantidad - a.cantidad ||
      a.motivo.localeCompare(b.motivo) ||
      a.zona.localeCompare(b.zona),
  );
}

/** D9: el bimestre `AAAA-NN` de un instante, según el día en Argentina. */
export function bimestreDe(instante: Date): string {
  const [anio, mes] = diaEnArgentina(instante).split('-').map(Number);
  return `${anio}-${String(Math.ceil(mes / 2)).padStart(2, '0')}`;
}
