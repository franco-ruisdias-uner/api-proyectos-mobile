import type { Evento } from '../../../contrato/tipos.js';
import { urlDeArchivo } from '../../comun/archivos/urls.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { EventoEntidad } from './evento.entidad.js';
import { estadoVisible } from './reglas/agenda.js';

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
