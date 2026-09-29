import type { Favorito } from '../../../contrato/tipos.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { FavoritoEntidad } from './favorito.entidad.js';

export function aContrato(f: FavoritoEntidad): Favorito {
  return { id: f.id, usuarioId: f.usuarioId, lugarId: f.lugarId, creadoEn: aIsoConZona(f.creadoEn) };
}
