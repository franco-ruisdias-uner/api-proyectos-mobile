import type { Usuario } from '../../../contrato/tipos.js';
import { urlDeArchivoONulo } from '../../comun/archivos/urls.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { UsuarioEntidad } from './usuario.entidad.js';

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
