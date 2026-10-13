import { Logger } from '@nestjs/common';
import { EnviadorPush, type MensajePush } from '../comun/notificaciones/puertos.js';

const TANDA = 100;

interface TicketExpo {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/** Manda las push con `fetch` a la API de Expo, en tandas de 100 mensajes. */
export class EnviadorPorHacer extends EnviadorPush {
  private readonly log = new Logger('EnviadorPorHacer');

  constructor(private readonly url: string) {
    super();
  }

  async enviar(
    mensajes: MensajePush[],
  ): Promise<{ tokensInvalidos: string[] }> {
    // Un mensaje de Expo por token: así cada ticket de la respuesta corresponde a un token.
    const individuales = mensajes.flatMap((m) =>
      m.tokens.map((to) => ({
        to,
        title: m.titulo,
        body: m.cuerpo,
        data: m.datos,
        sound: 'default',
      })),
    );
    const tokensInvalidos: string[] = [];
    for (let i = 0; i < individuales.length; i += TANDA) {
      const tanda = individuales.slice(i, i + TANDA);
      const respuesta = await fetch(this.url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(tanda),
      });
      if (!respuesta.ok) {
        this.log.error(
          `Expo respondió ${respuesta.status} a una tanda de ${tanda.length} mensajes.`,
        );
        continue;
      }
      const cuerpo = (await respuesta.json()) as { data?: TicketExpo[] };
      (cuerpo.data ?? []).forEach((ticket, j) => {
        if (ticket.status === 'error') {
          this.log.warn(
            `Expo no aceptó un mensaje: ${ticket.message ?? 'sin detalle'}`,
          );
          if (ticket.details?.error === 'DeviceNotRegistered' && tanda[j]) {
            tokensInvalidos.push(tanda[j].to);
          }
        }
      });
    }
    return { tokensInvalidos };
  }
}
