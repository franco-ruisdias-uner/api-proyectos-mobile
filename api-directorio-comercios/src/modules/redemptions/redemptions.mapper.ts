import type { UsoDePromocion as UsoContrato } from '../../../contract/types.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { UsoDePromocion } from './promotion-redemption.entity.js';

export function usoAContrato(u: UsoDePromocion): UsoContrato {
  return {
    id: u.id,
    promocionId: u.promocionId,
    usuarioId: u.usuarioId,
    codigo: u.codigo,
    validadoEn: u.validadoEn === null ? null : aIsoConZona(u.validadoEn),
  };
}
