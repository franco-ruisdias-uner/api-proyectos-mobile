import type { Visita } from '../../../contrato/tipos.js';
import { urlDeArchivoONulo } from '../../comun/archivos/urls.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { VisitaEntidad } from './visita.entidad.js';

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
