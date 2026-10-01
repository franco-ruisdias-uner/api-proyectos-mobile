import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENTORNO } from '../config/entorno.modulo.js';
import type { Entorno } from '../config/entorno.js';
import type { EnviadorPush, MensajePush } from '../comun/notificaciones/puertos.js';

const POR_TANDA = 100;

interface TicketExpo {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/** `NOTIFICACIONES=expo`: `fetch` a la API de Expo, en tandas de 100 mensajes. Sin SDK. */
@Injectable()
export class EnviadorExpo implements EnviadorPush {
  private readonly log = new Logger('Notificaciones');

  constructor(@Inject(ENTORNO) private readonly entorno: Entorno) {}

  async enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    const individuales = mensajes.flatMap((m) =>
      m.tokens.map((to) => ({ to, title: m.titulo, body: m.cuerpo, data: m.datos, sound: 'default' })),
    );
    const tokensInvalidos: string[] = [];
    for (let i = 0; i < individuales.length; i += POR_TANDA) {
      const tanda = individuales.slice(i, i + POR_TANDA);
      try {
        const res = await fetch(this.entorno.EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(tanda),
        });
        const cuerpo = (await res.json()) as { data?: TicketExpo[] };
        (cuerpo.data ?? []).forEach((ticket, j) => {
          if (ticket.status !== 'error') return;
          if (ticket.details?.error === 'DeviceNotRegistered') tokensInvalidos.push(tanda[j].to);
          else this.log.warn(`Expo rechazó una push: ${ticket.message}`);
        });
      } catch (error) {
        this.log.warn(`No se pudo hablar con Expo: ${(error as Error).message}`);
      }
    }
    return { tokensInvalidos };
  }
}
