import type { UsoDePromocion as UsoContrato } from '../../../contrato/tipos.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { UsoDePromocion } from './uso-de-promocion.entidad.js';

export function usoAContrato(u: UsoDePromocion): UsoContrato {
  return {
    id: u.id,
    promocionId: u.promocionId,
    usuarioId: u.usuarioId,
    codigo: u.codigo,
    validadoEn: u.validadoEn === null ? null : aIsoConZona(u.validadoEn),
  };
}
