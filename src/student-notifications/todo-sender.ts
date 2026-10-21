import { Injectable } from '@nestjs/common';
import {
  PendienteDeImplementar,
  type EnviadorPush,
  type MensajePush,
} from '../common/notifications/ports.js';

/**
 * Cómo se mandan las push a Expo. Esta pieza la programan ustedes: leé docs/NOTIFICATIONS.md y
 * corré `pnpm test:notificaciones` hasta que quede en verde.
 */
@Injectable()
export class EnviadorPorHacer implements EnviadorPush {
  // TODO(alumnos): Mandar los mensajes a la API de Expo con `fetch` (POST, JSON). La dirección sale
  // de la variable de entorno EXPO_PUSH_URL (inyectá `ENTORNO`, no la escribas fija). Expo recibe
  // un arreglo de mensajes individuales (uno por token) y acepta hasta 100 por pedido: partí en
  // tandas. Leé la respuesta (un ticket por mensaje, en el mismo orden) y devolvé en
  // `tokensInvalidos` los tokens cuyo ticket dice `DeviceNotRegistered`. Un error de red o de Expo
  // no puede romper el pedido: anotalo en el log y devolvé lo que puedas.
  enviar(_mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    throw new PendienteDeImplementar('enviar las push a Expo');
  }
}
