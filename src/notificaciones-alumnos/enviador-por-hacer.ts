// PARTE 2 DE 2 PARA PROGRAMAR — cómo se mandan las push a Expo.
// Leé docs/NOTIFICACIONES.md. Cuando funcione, `pnpm test:notificaciones` tiene que pasar.
import { ErrorApi } from '../comun/errores/error-api.js';
import {
  EnviadorPush,
  type MensajePush,
} from '../comun/notificaciones/puertos.js';

export class EnviadorPorHacer extends EnviadorPush {
  /** `url` es la dirección de la API de push de Expo (`EXPO_PUSH_URL` en la configuración). */
  constructor(readonly url: string) {
    super();
  }

  // TODO(alumnos): mandar los mensajes a Expo con `fetch` (POST de JSON a `this.url`).
  // Expo recibe un mensaje por token y acepta hasta 100 por pedido: si hay más, mandalos en
  // tandas. La respuesta trae un "ticket" por mensaje, en el mismo orden: los que dicen
  // `DeviceNotRegistered` son tokens que ya no sirven, y hay que devolverlos en
  // `tokensInvalidos` para que la API los descarte.
  enviar(_mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    throw new ErrorApi('NO_IMPLEMENTADO');
  }
}
