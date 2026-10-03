import type { Promocion as PromocionContrato } from '../../../contrato/tipos.js';
import { urlDeArchivo } from '../../comun/archivos/archivos.servicio.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { Promocion } from './promocion.entidad.js';

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
