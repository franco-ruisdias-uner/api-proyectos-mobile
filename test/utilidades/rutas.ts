import type { EstadoRuta } from '../../contrato/tipos.js';
import { RutaEntidad } from '../../src/modulos/rutas/ruta.entidad.js';
import { RutaSuministroEntidad } from '../../src/modulos/rutas/ruta-suministro.entidad.js';
import type { AppDePrueba } from './crear-app.js';
import { crearSuministro, type DatosSuministro } from './suministros.js';

export interface DatosRuta {
  numero?: string;
  nombre?: string;
  bimestre?: string;
  lectorId: string;
  estado?: EstadoRuta;
  descargadaEn?: Date | null;
  cerradaEn?: Date | null;
  /** Ids de suministros que ya existen, en el orden del recorrido. */
  suministroIds?: string[];
  /** Si no hay `suministroIds`, cuántos suministros nuevos crear (default 3). */
  cantidad?: number;
  /** Datos de cada suministro nuevo, por posición. */
  suministros?: DatosSuministro[];
}

let contador = 0;

/** Builder: una ruta con sus suministros, directo en la base. */
export async function crearRuta(
  c: AppDePrueba,
  datos: DatosRuta,
): Promise<{
  id: string;
  numero: string;
  bimestre: string;
  suministroIds: string[];
}> {
  contador += 1;
  const numero = datos.numero ?? String(100 + contador);
  const bimestre = datos.bimestre ?? '2026-05';
  const id = `rut-${numero}-${bimestre}`;
  const estado = datos.estado ?? 'asignada';
  let suministroIds = datos.suministroIds;
  if (!suministroIds) {
    suministroIds = [];
    const cantidad = datos.suministros?.length ?? datos.cantidad ?? 3;
    for (let i = 0; i < cantidad; i++) {
      const { suministro } = await crearSuministro(c, datos.suministros?.[i]);
      suministroIds.push(suministro.id);
    }
  }
  await c.dataSource.getRepository(RutaEntidad).insert({
    id,
    numero,
    nombre: datos.nombre ?? `Ruta ${numero}`,
    bimestre,
    lectorId: datos.lectorId,
    estado,
    descargadaEn:
      datos.descargadaEn === undefined
        ? estado === 'asignada'
          ? null
          : new Date('2026-09-15T10:40:00Z')
        : datos.descargadaEn,
    cerradaEn:
      datos.cerradaEn === undefined
        ? estado === 'cerrada'
          ? new Date('2026-09-14T20:02:00Z')
          : null
        : datos.cerradaEn,
  });
  await c.dataSource.getRepository(RutaSuministroEntidad).insert(
    suministroIds.map((suministroId, posicion) => ({
      rutaId: id,
      suministroId,
      bimestre,
      posicion,
    })),
  );
  return { id, numero, bimestre, suministroIds };
}
