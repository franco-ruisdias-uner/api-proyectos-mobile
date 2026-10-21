import { Repository } from 'typeorm';
import { elegirVigente } from './rules/readings.js';
import type { LecturaEntidad } from './reading.entity.js';

/** R13: las lecturas vigentes de una ruta (una por suministro), por suministro. */
export async function lecturasVigentesDeRuta(
  repo: Repository<LecturaEntidad>,
  rutaId: string,
): Promise<Map<string, LecturaEntidad>> {
  const todas = await repo.find({ where: { rutaId } });
  const porSuministro = new Map<string, LecturaEntidad[]>();
  for (const l of todas) {
    if (l.rutaId !== rutaId) continue;
    porSuministro.set(l.suministroId, [
      ...(porSuministro.get(l.suministroId) ?? []),
      l,
    ]);
  }
  const vigentes = new Map<string, LecturaEntidad>();
  for (const [suministroId, lecturas] of porSuministro) {
    const v = elegirVigente(lecturas, []);
    if (v?.tipo === 'lectura') vigentes.set(suministroId, v.resultado);
  }
  return vigentes;
}
