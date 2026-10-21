import { generarCodigoDeUso } from '../../src/modules/redemptions/rules/redemptions.js';
import { nuevoId } from '../../src/common/ids/ids.js';
import { UsoDePromocion } from '../../src/modules/redemptions/promotion-redemption.entity.js';
import type { AppDePrueba } from './create-app.js';

/** Builder de usos: inserta directo en la base. Por defecto, sin validar. */
export async function crearUso(
  t: AppDePrueba,
  datos: Partial<UsoDePromocion> & { promocionId: string; usuarioId: string },
): Promise<UsoDePromocion> {
  const uso: UsoDePromocion = {
    id: datos.id ?? nuevoId('uso'),
    promocionId: datos.promocionId,
    usuarioId: datos.usuarioId,
    codigo: datos.codigo ?? generarCodigoDeUso(),
    generadoEn: datos.generadoEn ?? t.reloj.ahora(),
    validadoEn: datos.validadoEn === undefined ? null : datos.validadoEn,
  };
  await t.dataSource.getRepository(UsoDePromocion).insert(uso);
  return uso;
}
