import { nuevoId } from '../../src/comun/ids/ids.js';
import { Resena } from '../../src/modulos/resenas/resena.entidad.js';
import type { AppDePrueba } from './crear-app.js';

/** Builder de reseñas: inserta directo en la base (no recalcula el puntaje del comercio). */
export async function crearResena(
  t: AppDePrueba,
  datos: Partial<Resena> & { comercioId: string; usuarioId: string },
): Promise<Resena> {
  const resena: Resena = {
    id: datos.id ?? nuevoId('res'),
    comercioId: datos.comercioId,
    usuarioId: datos.usuarioId,
    estrellas: datos.estrellas ?? 4,
    comentario: datos.comentario ?? 'Muy buena atención.',
    respuesta: datos.respuesta ?? null,
    reportada: datos.reportada ?? false,
    creadaEn: datos.creadaEn ?? new Date(t.reloj.ahora().getTime() - 60 * 60 * 1000),
  };
  await t.dataSource.getRepository(Resena).insert(resena);
  return resena;
}
