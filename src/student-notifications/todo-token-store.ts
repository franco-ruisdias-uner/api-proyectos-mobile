import { Injectable } from '@nestjs/common';
import { ErrorApi } from '../common/errors/error-api.js';
import {
  AlmacenTokensPush,
  type Plataforma,
} from '../common/notifications/ports.js';

/**
 * TODO(alumnos): acá viven los tokens de Expo de cada usuario. Hoy ningún método hace nada y
 * los tres endpoints de `/dispositivos` responden 501 `NO_IMPLEMENTADO`.
 *
 * Qué les toca: crear una entidad de TypeORM para los dispositivos (su tabla, sus columnas),
 * registrarla con `TypeOrmModule.forFeature([...])` en `DispositivosModulo`, y completar los
 * cuatro métodos. Cuando lo logren, `pnpm test:notificaciones` pasa a verde.
 * Guía: docs/NOTIFICATIONS.md.
 */
@Injectable()
export class AlmacenTokensPorHacer extends AlmacenTokensPush {
  /**
   * TODO(alumnos): guardar el token de ese usuario. Tiene que ser idempotente (mandar el mismo
   * token dos veces deja un solo registro, también si llegan al mismo tiempo) y, si el token lo
   * tenía otro usuario (teléfono compartido entre turnos), pasa a ser del usuario actual.
   */
  async guardar(
    _usuarioId: string,
    _tokenExpo: string,
    _plataforma: Plataforma,
  ): Promise<void> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }

  /**
   * TODO(alumnos): dar de baja el token. Si no estaba guardado, no es un error.
   */
  async borrar(_tokenExpo: string): Promise<void> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }

  /**
   * TODO(alumnos): devolver los tokens de todos esos usuarios, sin repetidos y siempre en el
   * mismo orden. Con una lista vacía, devolver una lista vacía.
   */
  async tokensDe(_usuarioIds: string[]): Promise<string[]> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }

  /**
   * TODO(alumnos): borrar de una vez estos tokens: son los que Expo dijo que ya no sirven.
   */
  async descartar(_tokens: string[]): Promise<void> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }
}
