import type { Favorito } from '../../../contract/types.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { FavoritoEntidad } from './favorite.entity.js';

export function aContrato(f: FavoritoEntidad): Favorito {
  return { id: f.id, usuarioId: f.usuarioId, lugarId: f.lugarId, creadoEn: aIsoConZona(f.creadoEn) };
}
