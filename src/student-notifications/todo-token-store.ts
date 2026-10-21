import { Injectable } from '@nestjs/common';
import { ErrorApi } from '../common/errors/error-api.js';
import type { AlmacenTokensPush, Plataforma } from '../common/notifications/ports.js';

/**
 * TODO(alumnos): acá viven los tokens de Expo de cada usuario. Mirá docs/NOTIFICATIONS.md.
 *
 * Mientras los métodos tiren `NO_IMPLEMENTADO`, los endpoints de /dispositivos responden 501 y
 * `Avisos` sólo escribe en el log que la push quedó pendiente. Cuando completen un método, saquen
 * el `throw`: el resto de la API no hay que tocarlo.
 */
@Injectable()
export class AlmacenTokensPorHacer implements AlmacenTokensPush {
  /**
   * TODO(alumnos): guardar que `tokenExpo` pertenece a `usuarioId` (con su plataforma).
   * - Si el token ya existía, se actualiza: no se duplica.
   * - Si lo tenía otro usuario (cambiaron de cuenta en el mismo teléfono), pasa al usuario actual.
   * - Dos pedidos simultáneos con el mismo token no pueden dejar dos filas ni tirar un error.
   */
  guardar(_usuarioId: string, _tokenExpo: string, _plataforma: Plataforma): Promise<void> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }

  /** TODO(alumnos): borrar el token. Si no estaba guardado, no es un error. */
  borrar(_tokenExpo: string): Promise<void> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }

  /**
   * TODO(alumnos): devolver los tokens de todos esos usuarios, sin repetir y en un orden estable.
   * Con una lista vacía, devolver una lista vacía.
   */
  tokensDe(_usuarioIds: string[]): Promise<string[]> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }

  /** TODO(alumnos): borrar estos tokens, que Expo informó como inválidos. */
  descartar(_tokens: string[]): Promise<void> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }
}
