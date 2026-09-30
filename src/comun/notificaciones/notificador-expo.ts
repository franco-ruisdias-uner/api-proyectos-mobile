import { Injectable, Logger } from '@nestjs/common';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { type MensajePush, Notificador, type ResultadoDeEnvio } from './notificador.js';

/** Envía por el servicio de push de Expo (`expo-server-sdk`). */
@Injectable()
export class NotificadorExpo extends Notificador {
  private readonly expo = new Expo();
  private readonly registro = new Logger('Push');

  async enviar(mensajes: MensajePush[]): Promise<ResultadoDeEnvio> {
    const tokensInvalidos: string[] = [];
    const validos = mensajes.filter((m) => {
      if (Expo.isExpoPushToken(m.tokenExpo)) return true;
      tokensInvalidos.push(m.tokenExpo);
      return false;
    });
    const aEnviar: ExpoPushMessage[] = validos.map((m) => ({
      to: m.tokenExpo,
      title: m.titulo,
      body: m.cuerpo,
      data: m.datos,
      sound: 'default',
    }));
    let enviados = 0;
    for (const tanda of this.expo.chunkPushNotifications(aEnviar)) {
      const tickets = await this.expo.sendPushNotificationsAsync(tanda);
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'ok') {
          enviados++;
          return;
        }
        this.registro.warn(`Expo rechazó una push: ${ticket.message}`);
        const destino = tanda[i].to;
        if (ticket.details?.error === 'DeviceNotRegistered' && typeof destino === 'string') {
          tokensInvalidos.push(destino);
        }
      });
    }
    this.registro.log(`Push enviadas: ${enviados} de ${mensajes.length}`);
    return { tokensInvalidos };
  }
}
