import type { MotivoDemora } from '../../contrato/tipos.js';
import { nuevoId } from '../../src/comun/ids/ids.js';
import { ConfirmacionDemoraEntidad } from '../../src/modulos/reportes/confirmacion-demora.entidad.js';
import { ReporteDemoraEntidad } from '../../src/modulos/reportes/reporte-demora.entidad.js';
import type { AppDePrueba } from './crear-app.js';

export interface DatosDeReporte {
  id?: string;
  lineaId: string;
  paradaId: string;
  usuarioId: string;
  motivo?: MotivoDemora;
  comentario?: string | null;
  fotoClave?: string | null;
  /** Minutos antes de "ahora" (reloj de la app). Por defecto 10. */
  haceMinutos?: number;
  confirmaronIds?: string[];
}

/** Builder de reporte de demora, directo en la base. */
export async function crearReporte(
  ctx: AppDePrueba,
  datos: DatosDeReporte,
): Promise<ReporteDemoraEntidad> {
  const fechaHora = new Date(ctx.reloj.ahora().getTime() - (datos.haceMinutos ?? 10) * 60_000);
  const confirmaronIds = datos.confirmaronIds ?? [];
  const reporte = ctx.dataSource.getRepository(ReporteDemoraEntidad).create({
    id: datos.id ?? nuevoId('rep'),
    lineaId: datos.lineaId,
    paradaId: datos.paradaId,
    usuarioId: datos.usuarioId,
    motivo: datos.motivo ?? 'demorado',
    comentario: datos.comentario ?? null,
    fotoClave: datos.fotoClave ?? null,
    confirmaciones: confirmaronIds.length,
    fechaHora,
  });
  await ctx.dataSource.getRepository(ReporteDemoraEntidad).insert(reporte);
  for (const usuarioId of confirmaronIds) {
    await ctx.dataSource
      .getRepository(ConfirmacionDemoraEntidad)
      .insert({ reporteId: reporte.id, usuarioId, creadaEn: ctx.reloj.ahora() });
  }
  return reporte;
}
