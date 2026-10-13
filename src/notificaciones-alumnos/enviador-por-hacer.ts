import { ErrorApi } from '../comun/errores/error-api.js';
import { EnviadorPush, type MensajePush } from '../comun/notificaciones/puertos.js';

/**
 * TODO(alumnos): acá se mandan las push a Expo. Hoy no manda nada.
 *
 * Qué les toca: completar `enviar` con un `fetch` (sin librerías nuevas) a `this.url`
 * (`EXPO_PUSH_URL`, ya viene configurada). Cuando lo logren, la parte "Consigna 2" de
 * `pnpm test:notificaciones` pasa a verde. Guía: docs/NOTIFICACIONES.md.
 */
export class EnviadorPorHacer extends EnviadorPush {
  constructor(readonly url: string) {
    super();
  }

  /**
   * TODO(alumnos): mandar los mensajes a Expo y devolver los tokens que Expo informa como
   * inválidos.
   *
   * Pistas, sin el código:
   * - Expo recibe una lista de mensajes con `to`, `title`, `body` y `data`; la respuesta trae un
   *   "ticket" por mensaje, en el mismo orden.
   * - Expo acepta hasta 100 mensajes por pedido: hay que partir en tandas.
   * - Un ticket con `status: 'error'` y `details.error` igual a `DeviceNotRegistered` quiere
   *   decir que ese token ya no sirve.
   * - Un error de red o una respuesta que no sea 2xx no tiene que romper nada afuera de acá:
   *   `Avisos` lo registra en el log y sigue.
   */
  async enviar(
    _mensajes: MensajePush[],
  ): Promise<{ tokensInvalidos: string[] }> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }
}
