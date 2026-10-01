import type { Coordenadas, Gravedad } from '../../contrato/tipos.js';
import { nuevoId } from '../../src/comun/ids/ids.js';
import { AvisoLineaEntidad } from '../../src/modulos/avisos/aviso-linea.entidad.js';
import { AvisoEntidad } from '../../src/modulos/avisos/aviso.entidad.js';
import type { AppDePrueba } from './crear-app.js';

let contador = 0;

export interface DatosDeAviso {
  id?: string;
  titulo?: string;
  detalle?: string;
  /** Ids de líneas ya creadas, en orden. */
  lineaIds: string[];
  desde?: Date | string;
  hasta?: Date | string | null;
  gravedad?: Gravedad;
  trazadoAlternativo?: Coordenadas[] | null;
  videoClave?: string | null;
}

/** Builder de aviso, directo en la base. Por defecto, vigente desde hace una hora y sin fin. */
export async function crearAviso(ctx: AppDePrueba, datos: DatosDeAviso): Promise<AvisoEntidad> {
  contador++;
  const desde = datos.desde
    ? new Date(datos.desde)
    : new Date(ctx.reloj.ahora().getTime() - 3600_000);
  const aviso = ctx.dataSource.getRepository(AvisoEntidad).create({
    id: datos.id ?? nuevoId('avi'),
    titulo: datos.titulo ?? `Aviso ${contador}`,
    detalle: datos.detalle ?? `Detalle del aviso ${contador}.`,
    desde,
    hasta: datos.hasta ? new Date(datos.hasta) : null,
    gravedad: datos.gravedad ?? 'informativo',
    trazadoAlternativo: datos.trazadoAlternativo ?? null,
    videoClave: datos.videoClave ?? null,
  });
  await ctx.dataSource.getRepository(AvisoEntidad).insert(aviso);
  for (const [orden, lineaId] of datos.lineaIds.entries()) {
    await ctx.dataSource
      .getRepository(AvisoLineaEntidad)
      .insert({ avisoId: aviso.id, lineaId, orden });
  }
  return aviso;
}
