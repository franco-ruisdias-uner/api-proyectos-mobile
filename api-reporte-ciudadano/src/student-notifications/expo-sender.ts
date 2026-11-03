import { Logger } from '@nestjs/common';
import type {
  EnviadorPush,
  MensajePush,
} from '../common/notifications/ports.js';

const MAXIMO_POR_PEDIDO = 100;

interface TicketExpo {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/** Manda las push al servicio de Expo (un mensaje por token, de a 100 por pedido). */
export class EnviadorExpo implements EnviadorPush {
  private readonly logger = new Logger('EnviadorExpo');

  constructor(
    readonly url: string,
    private readonly accessToken?: string,
  ) {}

  async enviar(
    mensajes: MensajePush[],
  ): Promise<{ tokensInvalidos: string[] }> {
    const planos = mensajes.flatMap((m) =>
      m.tokens.map((to) => ({
        to,
        title: m.titulo,
        body: m.cuerpo,
        data: m.datos,
        sound: 'default',
        priority: 'high',
        channelId: m.canal ?? 'default',
      })),
    );
    const tokensInvalidos: string[] = [];
    for (let i = 0; i < planos.length; i += MAXIMO_POR_PEDIDO) {
      const lote = planos.slice(i, i + MAXIMO_POR_PEDIDO);
      try {
        const tickets = await this.postear(lote);
        tickets.forEach((t, j) => {
          if (t.status !== 'error') return;
          if (t.details?.error === 'DeviceNotRegistered')
            tokensInvalidos.push(lote[j].to);
          else
            this.logger.warn(
              `Expo rechazó un mensaje: ${t.details?.error ?? t.message ?? 'sin detalle'}`,
            );
        });
      } catch (error) {
        this.logger.warn(
          `No se pudo mandar un lote a Expo: ${(error as Error).message}`,
        );
      }
    }
    return { tokensInvalidos };
  }

  private async postear(lote: object[]): Promise<TicketExpo[]> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    const res = await fetch(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(lote),
    });
    if (!res.ok) throw new Error(`Expo respondió ${res.status}`);
    const json = (await res.json()) as { data?: TicketExpo[] };
    return Array.isArray(json.data) ? json.data : [];
  }
}
