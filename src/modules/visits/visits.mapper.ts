import type { Visita } from '../../../contract/types.js';
import { urlDeArchivoONulo } from '../../common/files/urls.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { VisitaEntidad } from './visit.entity.js';

export function aContrato(v: VisitaEntidad): Visita {
  return {
    id: v.id,
    usuarioId: v.usuarioId,
    lugarId: v.lugarId,
    fechaHora: aIsoConZona(v.fechaHora),
    origen: v.origen,
    fotoUri: urlDeArchivoONulo(v.fotoClave),
    nota: v.nota,
    sincronizada: true,
  };
}
