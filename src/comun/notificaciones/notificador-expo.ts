import { Logger } from '@nestjs/common';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import {
  Notificador,
  type MensajePush,
  type ResultadoEnvio,
} from './notificador.js';

/** Manda las push por el servicio de Expo (sin credenciales: alcanza con el token del teléfono). */
export class NotificadorExpo extends Notificador {
  private readonly expo = new Expo();
  private readonly logger = new Logger('Push');

  async enviar(mensajes: MensajePush[]): Promise<ResultadoEnvio> {
    const tokensInvalidos: string[] = [];
    const validos = mensajes.filter((m) => {
      if (Expo.isExpoPushToken(m.tokenExpo)) return true;
      tokensInvalidos.push(m.tokenExpo);
      return false;
    });
    const aExpo: ExpoPushMessage[] = validos.map((m) => ({
      to: m.tokenExpo,
      title: m.titulo,
      body: m.cuerpo,
      data: m.datos ?? {},
      sound: 'default',
    }));

    for (const lote of this.expo.chunkPushNotifications(aExpo)) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(lote);
        tickets.forEach((ticket, i) => {
          if (ticket.status !== 'error') return;
          if (ticket.details?.error === 'DeviceNotRegistered') {
            tokensInvalidos.push(String(lote[i].to));
          } else {
            this.logger.warn(`Expo rechazó una push: ${ticket.message}`);
          }
        });
      } catch (error) {
        // Sin internet o Expo caído: se loguea y sigue (AGENTS §9).
        this.logger.warn(
          `No se pudieron mandar ${lote.length} push: ${(error as Error).message}`,
        );
      }
    }
    return { tokensInvalidos };
  }
}
