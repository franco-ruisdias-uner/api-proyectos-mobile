import type { Evento } from '../../../contract/types.js';
import { urlDeArchivo } from '../../common/files/urls.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { EventoEntidad } from './event.entity.js';
import { estadoVisible } from './rules/agenda.js';

/** La única salida de un evento hacia el cliente. `finalizado` se calcula con "ahora" (R9). */
export function aContrato(e: EventoEntidad, ahora: Date): Evento {
  return {
    id: e.id,
    titulo: e.titulo,
    descripcion: e.descripcion,
    lugarId: e.lugarId,
    direccionLibre: e.direccionLibre,
    coordenadas:
      e.latitud === null || e.longitud === null ? null : { latitud: e.latitud, longitud: e.longitud },
    inicio: aIsoConZona(e.inicio),
    fin: e.fin === null ? null : aIsoConZona(e.fin),
    imagenUrl: e.imagenClave === null ? null : urlDeArchivo(e.imagenClave),
    precio: e.precio,
    estado: estadoVisible(e.estado, e.finEfectivo, ahora),
  };
}
