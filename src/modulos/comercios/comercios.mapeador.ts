import type {
  Comercio as ComercioContrato,
  Rubro as RubroContrato,
} from '../../../contrato/tipos.js';
import { urlDeArchivo } from '../../comun/archivos/archivos.servicio.js';
import type { Comercio } from './comercio.entidad.js';
import { codigoQrDe, horariosVisibles } from './reglas/comercios.js';
import type { Rubro } from './rubro.entidad.js';

export function rubroAContrato(r: Rubro): RubroContrato {
  return { id: r.id, nombre: r.nombre, icono: r.icono, color: r.color, orden: r.orden };
}

/** Entidad → `Comercio` del PRD. `hoy` ("AAAA-MM-DD", Buenos Aires) decide el cierre por vacaciones (D2). */
export function comercioAContrato(c: Comercio, hoy: string): ComercioContrato {
  return {
    id: c.id,
    nombre: c.nombre,
    rubroId: c.rubroId,
    descripcion: c.descripcion,
    direccion: c.direccion,
    coordenadas: { latitud: c.latitud, longitud: c.longitud },
    telefono: c.telefono ?? null,
    whatsapp: c.whatsapp ?? null,
    instagram: c.instagram ?? null,
    imagenes: c.imagenes.map(urlDeArchivo),
    videoUrl: c.videoClave ? urlDeArchivo(c.videoClave) : null,
    horarios: horariosVisibles(c.horarios, c.cerradoHasta ?? null, hoy),
    mediosDePago: c.mediosDePago,
    puntaje: c.puntaje,
    cantidadResenas: c.cantidadResenas,
    codigoQr: codigoQrDe(c.id),
    activo: c.activo,
  };
}
