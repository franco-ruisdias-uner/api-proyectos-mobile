import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONFIGURACION, type Configuracion } from '../config/configuracion.js';
import { EnviadorPush, type MensajePush } from '../comun/notificaciones/puertos.js';

const POR_TANDA = 100;

interface MensajeExpo {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: 'default';
}

/** Un ticket de la respuesta de Expo: uno por mensaje, en el mismo orden. */
interface TicketExpo {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/** Envía con `fetch` a la API de push de Expo, en tandas de 100 mensajes. */
@Injectable()
export class EnviadorExpo extends EnviadorPush {
  private readonly registro = new Logger('Push');

  constructor(@Inject(CONFIGURACION) private readonly config: Configuracion) {
    super();
  }

  async enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    const aEnviar: MensajeExpo[] = mensajes.flatMap((m) =>
      m.tokens.map((to) => ({
        to,
        title: m.titulo,
        body: m.cuerpo,
        data: m.datos,
        sound: 'default' as const,
      })),
    );
    const tokensInvalidos: string[] = [];
    let enviados = 0;
    for (let i = 0; i < aEnviar.length; i += POR_TANDA) {
      const tanda = aEnviar.slice(i, i + POR_TANDA);
      const tickets = await this.enviarTanda(tanda);
      tickets.forEach((ticket, j) => {
        if (ticket.status === 'ok') {
          enviados++;
          return;
        }
        this.registro.warn(`Expo rechazó una push: ${ticket.message ?? 'sin detalle'}`);
        if (ticket.details?.error === 'DeviceNotRegistered') tokensInvalidos.push(tanda[j].to);
      });
    }
    this.registro.log(`Push enviadas: ${enviados} de ${aEnviar.length}`);
    return { tokensInvalidos };
  }

  private async enviarTanda(tanda: MensajeExpo[]): Promise<TicketExpo[]> {
    const respuesta = await fetch(this.config.expoPushUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(tanda),
      signal: AbortSignal.timeout(15_000),
    });
    if (!respuesta.ok) throw new Error(`Expo respondió ${respuesta.status}`);
    const cuerpo = (await respuesta.json()) as { data?: TicketExpo[] };
    if (!Array.isArray(cuerpo.data)) throw new Error('Expo respondió con un formato inesperado');
    return cuerpo.data;
  }
}
