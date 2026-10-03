import { nuevoId } from '../../src/comun/ids/ids.js';
import { Promocion } from '../../src/modulos/promociones/promocion.entidad.js';
import type { AppDePrueba } from './crear-app.js';

const DIA = 24 * 60 * 60 * 1000;

/**
 * Builder de promociones: inserta directo en la base. Por defecto es vigente respecto del
 * reloj de la app (empezó ayer, termina en 10 días).
 */
export async function crearPromocion(
  t: AppDePrueba,
  datos: Partial<Promocion> & { comercioId: string },
): Promise<Promocion> {
  const ahora = t.reloj.ahora().getTime();
  const promo: Promocion = {
    id: datos.id ?? nuevoId('pro'),
    comercioId: datos.comercioId,
    titulo: datos.titulo ?? '15% en pinturas',
    detalle: datos.detalle ?? 'Válido en pinturas de todas las marcas.',
    descuento: datos.descuento === undefined ? 15 : datos.descuento,
    desde: datos.desde ?? new Date(ahora - DIA),
    hasta: datos.hasta ?? new Date(ahora + 10 * DIA),
    imagenClave: datos.imagenClave ?? null,
    soloApp: datos.soloApp ?? false,
    usos: datos.usos ?? 0,
    activa: datos.activa ?? true,
  };
  await t.dataSource.getRepository(Promocion).insert(promo);
  return promo;
}

/** Un instante a `dias` días (puede ser fraccionario o negativo) del reloj de la app. */
export const enDias = (t: AppDePrueba, dias: number): Date =>
  new Date(t.reloj.ahora().getTime() + dias * DIA);
