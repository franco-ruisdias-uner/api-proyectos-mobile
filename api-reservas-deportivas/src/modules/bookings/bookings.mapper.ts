import type { Reserva } from '../../../contract/types.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { ReservaEntidad } from '../slots/reserva.entity.js';
import { cancelableHasta } from './rules/bookings.js';

/** Entidad → Reserva del PRD. Nada de `ocupacion`, `fecha` ni `inicio` sale de acá. */
export function aContrato(r: ReservaEntidad): Reserva {
  return {
    id: r.id,
    turnoId: r.turnoId,
    espacioId: r.espacioId,
    usuarioId: r.usuarioId,
    cantidadPersonas: r.cantidadPersonas,
    codigoQr: r.codigoQr,
    estado: r.estado,
    ingresoEn: r.ingresoEn ? aIsoConZona(r.ingresoEn) : null,
    creadaEn: aIsoConZona(r.creadaEn),
    cancelableHasta: aIsoConZona(cancelableHasta(r.fecha, r.inicio)),
  };
}
