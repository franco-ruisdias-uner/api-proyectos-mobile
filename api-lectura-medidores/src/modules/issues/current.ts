import { In, Repository } from 'typeorm';
import { elegirVigente } from '../readings/rules/readings.js';
import type { LecturaEntidad } from '../readings/reading.entity.js';
import type { NovedadEntidad } from './issue.entity.js';

const TANDA = 100;

function enTandas<T>(filas: T[]): T[][] {
  const tandas: T[][] = [];
  for (let i = 0; i < filas.length; i += TANDA)
    tandas.push(filas.slice(i, i + TANDA));
  return tandas;
}

/**
 * R13: las novedades vigentes de esas rutas. Un suministro con alguna lectura no tiene novedad
 * vigente (la lectura gana siempre); si no, es la más reciente. Devuelve, por ruta y suministro
 * (`rutaId|suministroId`), la vigente. Nada se borra.
 */
export async function novedadesVigentes(
  novedades: Repository<NovedadEntidad>,
  lecturas: Repository<LecturaEntidad>,
  rutaIds: string[],
): Promise<Map<string, NovedadEntidad>> {
  const buscadas = new Set(rutaIds);
  const porSuministro = new Map<string, NovedadEntidad[]>();
  const conLectura = new Set<string>();
  for (const tanda of enTandas(rutaIds)) {
    for (const n of await novedades.findBy({ rutaId: In(tanda) })) {
      // MySQL y MariaDB comparan sin distinguir mayúsculas: se confirma acá.
      if (!buscadas.has(n.rutaId)) continue;
      const clave = `${n.rutaId}|${n.suministroId}`;
      porSuministro.set(clave, [...(porSuministro.get(clave) ?? []), n]);
    }
    const leidas = await lecturas.find({
      select: { rutaId: true, suministroId: true },
      where: { rutaId: In(tanda) },
    });
    for (const l of leidas) conLectura.add(`${l.rutaId}|${l.suministroId}`);
  }
  const vigentes = new Map<string, NovedadEntidad>();
  for (const [clave, lista] of porSuministro) {
    if (conLectura.has(clave)) continue;
    const v = elegirVigente([], lista);
    if (v?.tipo === 'novedad') vigentes.set(clave, v.resultado);
  }
  return vigentes;
}
