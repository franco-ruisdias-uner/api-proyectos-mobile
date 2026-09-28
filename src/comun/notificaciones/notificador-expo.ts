import { Logger } from '@nestjs/common';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { Notificador, type MensajePush, type ResultadoEnvio } from './notificador.js';

/** `NOTIFICACIONES=expo`: manda las push por el servicio de Expo. */
export class NotificadorExpo extends Notificador {
  private readonly expo = new Expo();
  private readonly log = new Logger('Notificaciones');

  async enviar(mensajes: MensajePush[]): Promise<ResultadoEnvio> {
    const tokensInvalidos: string[] = [];
    const individuales: ExpoPushMessage[] = [];
    for (const m of mensajes) {
      for (const token of m.tokens) {
        if (!Expo.isExpoPushToken(token)) {
          tokensInvalidos.push(token);
          continue;
        }
        individuales.push({ to: token, title: m.titulo, body: m.cuerpo, data: m.datos, sound: 'default' });
      }
    }
    for (const lote of this.expo.chunkPushNotifications(individuales)) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(lote);
        tickets.forEach((ticket, i) => {
          if (ticket.status === 'error') {
            if (ticket.details?.error === 'DeviceNotRegistered') tokensInvalidos.push(String(lote[i].to));
            else this.log.warn(`Expo rechazó una push: ${ticket.message}`);
          }
        });
      } catch (error) {
        this.log.warn(`No se pudo hablar con Expo: ${(error as Error).message}`);
      }
    }
    return { tokensInvalidos };
  }
}
