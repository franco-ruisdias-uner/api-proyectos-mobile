import type { Sentido, TipoDeDia } from '../../contrato/tipos.js';
import { nuevoId } from '../../src/comun/ids/ids.js';
import { FeriadoEntidad } from '../../src/modulos/horarios/feriado.entidad.js';
import { HorarioEntidad } from '../../src/modulos/horarios/horario.entidad.js';
import type { AppDePrueba } from './crear-app.js';

export interface DatosDeHorario {
  id?: string;
  lineaId: string;
  paradaId: string;
  sentido?: Sentido;
  tipoDeDia?: TipoDeDia;
  hora?: string;
}

/** Builder de horario de tabla, directo en la base. */
export async function crearHorario(
  ctx: AppDePrueba,
  datos: DatosDeHorario,
): Promise<HorarioEntidad> {
  const horario = ctx.dataSource.getRepository(HorarioEntidad).create({
    id: datos.id ?? nuevoId('hor'),
    lineaId: datos.lineaId,
    paradaId: datos.paradaId,
    sentido: datos.sentido ?? 'ida',
    tipoDeDia: datos.tipoDeDia ?? 'habil',
    hora: datos.hora ?? '10:00',
  });
  await ctx.dataSource.getRepository(HorarioEntidad).insert(horario);
  return horario;
}

/** Varias horas de una vez para la misma línea y parada. */
export async function crearHorarios(
  ctx: AppDePrueba,
  base: Omit<DatosDeHorario, 'hora' | 'id'>,
  horas: string[],
): Promise<HorarioEntidad[]> {
  const creados: HorarioEntidad[] = [];
  for (const hora of horas) creados.push(await crearHorario(ctx, { ...base, hora }));
  return creados;
}

export async function crearFeriado(
  ctx: AppDePrueba,
  fecha: string,
  nombre = 'Feriado de prueba',
): Promise<void> {
  await ctx.dataSource.getRepository(FeriadoEntidad).insert({ fecha, nombre });
}
