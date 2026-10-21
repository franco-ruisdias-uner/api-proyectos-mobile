import type { Lectura } from '../../../contract/types.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { LecturaEntidad } from './reading.entity.js';

/** Entidad → `Lectura` del PRD. `urlDeArchivo` hace absoluta la clave de la foto. */
export function aContrato(
  l: LecturaEntidad,
  urlDeArchivo: (clave: string) => string,
): Lectura {
  return {
    id: l.id,
    rutaId: l.rutaId,
    suministroId: l.suministroId,
    lectorId: l.lectorId,
    valor: l.valor,
    consumo: l.consumo,
    fotoUri: urlDeArchivo(l.fotoClave),
    coordenadas:
      l.latitud === null || l.longitud === null
        ? null
        : { latitud: l.latitud, longitud: l.longitud },
    fueraDeRango: l.fueraDeRango,
    confirmadaPorLector: l.confirmadaPorLector,
    fechaHora: aIsoConZona(l.fechaHora),
    sincronizada: true,
  };
}
