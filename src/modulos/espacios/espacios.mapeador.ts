import type { Deporte, Espacio } from '../../../contrato/tipos.js';
import { urlDeArchivo } from '../../comun/archivos/claves.js';
import type { DeporteEntidad } from './deporte.entidad.js';
import type { EspacioEntidad } from './espacio.entidad.js';

export function deporteAContrato(d: DeporteEntidad): Deporte {
  return { id: d.id, nombre: d.nombre, icono: d.icono, color: d.color };
}

/** Entidad → Espacio del PRD. */
export function aContrato(e: EspacioEntidad): Espacio {
  return {
    id: e.id,
    nombre: e.nombre,
    deporteId: e.deporteId,
    complejo: e.complejo,
    superficie: e.superficie,
    techado: e.techado,
    iluminacion: e.iluminacion,
    capacidad: e.capacidad,
    precioPorHora: e.precioPorHora,
    coordenadas: { latitud: e.latitud, longitud: e.longitud },
    imagenes: e.imagenes.map(urlDeArchivo),
    videoUrl: e.videoUrl === null ? null : urlDeArchivo(e.videoUrl),
    reglas: e.reglas,
    activo: e.activo,
  };
}
