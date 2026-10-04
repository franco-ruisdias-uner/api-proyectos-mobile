// Envío por la API HTTP de Expo con fetch nativo (sin expo-server-sdk). Un mensaje
// por token, en tandas de 100 (el máximo que acepta Expo por pedido). Los tickets
// vuelven en el mismo orden; DeviceNotRegistered → token inválido.
import { Logger } from '@nestjs/common';
import { EnviadorPush, type MensajePush } from './puertos.js';

export const TANDA_EXPO = 100;

interface MensajeExpo {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: 'default';
}

interface TicketExpo {
  status?: string;
  details?: { error?: string };
}

export class EnviadorExpo extends EnviadorPush {
  private readonly logger = new Logger('EnviadorExpo');

  constructor(private readonly url: string) {
    super();
  }

  async enviar(
    mensajes: MensajePush[],
  ): Promise<{ tokensInvalidos: string[] }> {
    const individuales: MensajeExpo[] = mensajes.flatMap((m) =>
      m.tokens.map((to) => ({
        to,
        title: m.titulo,
        body: m.cuerpo,
        data: m.datos,
        sound: 'default' as const,
      })),
    );
    const tokensInvalidos: string[] = [];
    for (let i = 0; i < individuales.length; i += TANDA_EXPO) {
      const tanda = individuales.slice(i, i + TANDA_EXPO);
      const respuesta = await fetch(this.url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(tanda),
      });
      if (!respuesta.ok) {
        this.logger.error(
          `Expo respondió ${respuesta.status}: ${await respuesta.text()}`,
        );
        continue;
      }
      const cuerpo = (await respuesta.json()) as {
        data?: TicketExpo[] | TicketExpo;
      };
      const tickets = Array.isArray(cuerpo.data)
        ? cuerpo.data
        : cuerpo.data
          ? [cuerpo.data]
          : [];
      tickets.forEach((ticket, j) => {
        if (
          ticket.status === 'error' &&
          ticket.details?.error === 'DeviceNotRegistered' &&
          tanda[j]
        ) {
          tokensInvalidos.push(tanda[j].to);
        }
      });
    }
    return { tokensInvalidos };
  }
}
