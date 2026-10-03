import { Logger } from '@nestjs/common';
import type { EnviadorPush, MensajePush } from './puertos.js';

const TANDA = 100;

interface TicketExpo {
  status?: string;
  details?: { error?: string };
}

/**
 * Manda las push con `fetch` a la API de Expo, sin SDK (AGENTS §9). Un mensaje por token, en
 * tandas de 100. Los tokens que Expo responde como `DeviceNotRegistered` vuelven como inválidos.
 */
export class EnviadorExpo implements EnviadorPush {
  private readonly logger = new Logger('Push');

  constructor(private readonly url: string) {}

  async enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
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
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify(tanda),
      });
      if (!respuesta.ok) {
        this.logger.warn(`Expo respondió ${respuesta.status} a una tanda de ${tanda.length} push.`);
        continue;
      }
      const cuerpo = (await respuesta.json()) as { data?: TicketExpo[] };
      (cuerpo.data ?? []).forEach((ticket, j) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          tokensInvalidos.push(tanda[j].to);
        }
      });
    }
    return { tokensInvalidos };
  }
}
