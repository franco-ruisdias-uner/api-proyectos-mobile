import type { Lugar } from '../../../contrato/tipos.js';
import { urlDeArchivo } from '../../comun/archivos/urls.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { LugarEntidad } from './lugar.entidad.js';
import { actualizadoEnVigente, horariosVigentes } from './reglas/horarios.js';

/**
 * La única salida de un lugar hacia el cliente (R1): todos los campos, `null` donde no hay.
 * Necesita "ahora" porque los horarios son los de la temporada vigente (R3, D1).
 * Nada de distancias ni "abierto ahora" (R4): eso lo calcula el teléfono.
 */
export function aContrato(l: LugarEntidad, ahora: Date): Lugar {
  return {
    id: l.id,
    nombre: l.nombre,
    categoriaId: l.categoriaId,
    descripcionCorta: l.descripcionCorta,
    descripcion: l.descripcion,
    coordenadas: { latitud: l.latitud, longitud: l.longitud },
    direccion: l.direccion,
    imagenes: l.imagenes.map(urlDeArchivo),
    horarios: horariosVigentes(l.horarios, ahora),
    telefono: l.telefono,
    sitioWeb: l.sitioWeb,
    precioEntrada: l.precioEntrada,
    audioguia:
      l.audioguiaClave === null || l.audioguiaDuracionSegundos === null || l.audioguiaIdioma === null
        ? null
        : {
            url: urlDeArchivo(l.audioguiaClave),
            duracionSegundos: l.audioguiaDuracionSegundos,
            idioma: l.audioguiaIdioma,
          },
    codigoQr: l.codigoQr,
    accesible: l.accesible,
    activo: l.activo,
    actualizadoEn: aIsoConZona(actualizadoEnVigente(l.actualizadoEn, l.tieneTemporadas, ahora)),
  };
}
