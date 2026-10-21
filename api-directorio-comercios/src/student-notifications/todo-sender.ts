import type { EnviadorPush, MensajePush } from '../common/notifications/ports.js';
import { ErrorApi } from '../common/errors/error-api.js';

/**
 * TODO(alumnos): manda las push a la API de Expo. Mirá docs/NOTIFICATIONS.md.
 *
 * `url` es la dirección de la API de Expo (`EXPO_PUSH_URL`); en los tests es un servidor falso.
 * Mientras `enviar` tire `NO_IMPLEMENTADO`, `Avisos` escribe en el log que la push quedó pendiente.
 */
export class EnviadorPorHacer implements EnviadorPush {
  constructor(protected readonly url: string) {}

  /**
   * TODO(alumnos): hacer un `fetch` POST a `url` con los mensajes.
   * - Cada token es un mensaje de Expo (`to`, `title`, `body`, `data`, `sound`).
   * - Expo acepta hasta 100 mensajes por pedido: mandar en tandas.
   * - Leer la respuesta y devolver en `tokensInvalidos` los que Expo marca como `DeviceNotRegistered`.
   * - Si Expo responde con un error HTTP, no tirar: loguearlo y seguir con la tanda que sigue.
   */
  enviar(_mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }
}
