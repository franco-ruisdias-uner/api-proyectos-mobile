import type { Promocion as PromocionContrato } from '../../../contract/types.js';
import { urlDeArchivo } from '../../common/files/files.service.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { Promocion } from './promotion.entity.js';

export function promocionAContrato(p: Promocion): PromocionContrato {
  return {
    id: p.id,
    comercioId: p.comercioId,
    titulo: p.titulo,
    detalle: p.detalle,
    descuento: p.descuento,
    desde: aIsoConZona(p.desde),
    hasta: aIsoConZona(p.hasta),
    imagenUrl: p.imagenClave ? urlDeArchivo(p.imagenClave) : null,
    soloApp: p.soloApp,
    usos: p.usos,
    activa: p.activa,
  };
}
