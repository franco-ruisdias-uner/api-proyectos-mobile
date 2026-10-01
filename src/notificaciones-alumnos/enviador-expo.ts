import { Injectable, Logger } from '@nestjs/common';
import type {
  EnviadorPush,
  MensajePush,
} from '../comun/notificaciones/puertos.js';

/** Expo acepta hasta 100 mensajes por pedido. */
const TANDA = 100;

interface TicketExpo {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/**
 * Manda las push con `fetch` a la API de Expo (sin credenciales: alcanza con el token del
 * teléfono). Un mensaje de Expo por token; la respuesta trae un ticket por mensaje, en el mismo
 * orden, y `DeviceNotRegistered` marca un token muerto.
 */
@Injectable()
export class EnviadorExpo implements EnviadorPush {
  private readonly logger = new Logger('Push');

  constructor(private readonly url: string) {}

  async enviar(
    mensajes: MensajePush[],
  ): Promise<{ tokensInvalidos: string[] }> {
    const tokensInvalidos: string[] = [];
    const aExpo = mensajes.flatMap((m) =>
      m.tokens.map((to) => ({
        to,
        title: m.titulo,
        body: m.cuerpo,
        data: m.datos,
        sound: 'default',
      })),
    );
    for (let i = 0; i < aExpo.length; i += TANDA) {
      const tanda = aExpo.slice(i, i + TANDA);
      try {
        const respuesta = await fetch(this.url, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify(tanda),
        });
        if (!respuesta.ok)
          throw new Error(`Expo respondió ${respuesta.status}`);
        const { data } = (await respuesta.json()) as { data?: TicketExpo[] };
        (data ?? []).forEach((ticket, j) => {
          if (ticket.status !== 'error') return;
          if (ticket.details?.error === 'DeviceNotRegistered')
            tokensInvalidos.push(tanda[j].to);
          else this.logger.warn(`Expo rechazó una push: ${ticket.message}`);
        });
      } catch (error) {
        // Sin internet o Expo caído: se loguea y sigue (AGENTS §9).
        this.logger.warn(
          `No se pudieron mandar ${tanda.length} push: ${(error as Error).message}`,
        );
      }
    }
    return { tokensInvalidos };
  }
}
