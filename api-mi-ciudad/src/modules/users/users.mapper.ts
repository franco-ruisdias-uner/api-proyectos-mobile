import type { Usuario } from '../../../contract/types.js';
import { urlDeArchivoONulo } from '../../common/files/urls.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { UsuarioEntidad } from './user.entity.js';

/** La única salida de un usuario hacia el cliente: sin hash ni rol. */
export function aContrato(u: UsuarioEntidad): Usuario {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    avatarUrl: urlDeArchivoONulo(u.avatarClave),
    creadoEn: aIsoConZona(u.creadoEn),
    preferencias: {
      categoriasFavoritas: [...u.preferencias.categoriasFavoritas],
      avisarProximidad: u.preferencias.avisarProximidad,
      radioAvisoMetros: u.preferencias.radioAvisoMetros,
      tema: u.preferencias.tema,
    },
  };
}
