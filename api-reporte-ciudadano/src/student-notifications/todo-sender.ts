import { Injectable } from '@nestjs/common';
import {
  PuertoSinImplementar,
  type EnviadorPush,
  type MensajePush,
} from '../common/notifications/ports.js';

/**
 * TODO(alumnos): mandar las push al servicio de Expo.
 *
 * `url` es la dirección del servicio (variable EXPO_PUSH_URL; en los tests es un servidor falso).
 */
@Injectable()
export class EnviadorPorHacer implements EnviadorPush {
  constructor(readonly url: string) {}

  /**
   * TODO(alumnos): hacer un POST con `fetch` a `this.url` con los mensajes en el formato de Expo
   * (un mensaje por token), de a 100 como máximo por pedido. Leer la respuesta: Expo contesta un
   * "ticket" por mensaje, en el mismo orden. Devolver en `tokensInvalidos` los que Expo marca con
   * el error DeviceNotRegistered. Si Expo falla, no tirar el error: loguearlo y seguir.
   */
  enviar(_mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    return Promise.reject(new PuertoSinImplementar('enviar'));
  }
}
