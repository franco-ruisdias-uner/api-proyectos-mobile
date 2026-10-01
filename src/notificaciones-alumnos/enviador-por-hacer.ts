import { Injectable } from '@nestjs/common';
import { ErrorDeApi } from '../comun/errores/error-de-api.js';
import { EnviadorPush, type MensajePush } from '../comun/notificaciones/puertos.js';

/**
 * PARTE 2 DE LOS ALUMNOS: mandar las push a Expo.
 *
 * Hoy responde 501 NO_IMPLEMENTADO. Reemplacen el cuerpo y corran `pnpm test:notificaciones`
 * hasta que dé verde. Las pistas están en docs/NOTIFICACIONES.md.
 */
@Injectable()
export class EnviadorPorHacer extends EnviadorPush {
  /**
   * TODO(alumnos): mandar los mensajes a la API de push de Expo y devolver qué tokens no sirven.
   * - La dirección está en la variable de entorno EXPO_PUSH_URL (configuración: `expoPushUrl`).
   * - Cada `MensajePush` trae varios tokens; a Expo se le manda un mensaje por teléfono.
   * - Expo acepta hasta 100 mensajes por pedido: hay que mandar en tandas.
   * - Expo responde un "ticket" por mensaje, en el mismo orden. Los que dicen
   *   `DeviceNotRegistered` van en `tokensInvalidos`.
   * - Si Expo no responde bien, falla con un error: quien llama (`Avisos`) lo registra y sigue.
   */
  enviar(_mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    return Promise.reject(new ErrorDeApi('NO_IMPLEMENTADO'));
  }
}
