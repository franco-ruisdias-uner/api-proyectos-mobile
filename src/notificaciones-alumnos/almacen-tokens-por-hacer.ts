import { Injectable } from '@nestjs/common';
import { ErrorDeApi } from '../comun/errores/error-de-api.js';
import { AlmacenTokensPush, type Plataforma } from '../comun/notificaciones/puertos.js';

/**
 * PARTE 1 DE LOS ALUMNOS: guardar los tokens de Expo de cada usuario.
 *
 * Hoy cada método responde 501 NO_IMPLEMENTADO. Reemplacen el cuerpo de cada uno y corran
 * `pnpm test:notificaciones` hasta que dé verde. Las pistas están en docs/NOTIFICACIONES.md.
 */
@Injectable()
export class AlmacenTokensPorHacer extends AlmacenTokensPush {
  /**
   * TODO(alumnos): dejar guardado que este teléfono (`tokenExpo`) es de este usuario.
   * - Registrar el mismo token dos veces no tiene que duplicar nada ni dar error.
   * - Si el token ya era de otro usuario (alguien cerró sesión y entró otra persona en el mismo
   *   teléfono), pasa a ser del usuario actual.
   * - Dos pedidos simultáneos con el mismo token tienen que dejar un solo registro: acordate de
   *   AGENTS.md §5.5 (la base garantiza la unicidad, no sólo un `if`).
   */
  guardar(_usuarioId: string, _tokenExpo: string, _plataforma: Plataforma): Promise<void> {
    return Promise.reject(new ErrorDeApi('NO_IMPLEMENTADO'));
  }

  /**
   * TODO(alumnos): borrar ese token. Si no existe, no es un error.
   */
  borrar(_tokenExpo: string): Promise<void> {
    return Promise.reject(new ErrorDeApi('NO_IMPLEMENTADO'));
  }

  /**
   * TODO(alumnos): devolver los tokens de todos los teléfonos de esos usuarios.
   * Con una lista vacía, devuelve una lista vacía.
   */
  tokensDe(_usuarioIds: string[]): Promise<string[]> {
    return Promise.reject(new ErrorDeApi('NO_IMPLEMENTADO'));
  }

  /**
   * TODO(alumnos): borrar estos tokens (Expo dijo que ya no sirven). Los demás quedan.
   */
  descartar(_tokens: string[]): Promise<void> {
    return Promise.reject(new ErrorDeApi('NO_IMPLEMENTADO'));
  }
}
