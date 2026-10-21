import { Logger } from '@nestjs/common';
import type { EnviadorPush, MensajePush } from './ports.js';

/** NOTIFICACIONES=registro: no manda nada, sólo lo escribe en el log. */
export class EnviadorRegistro implements EnviadorPush {
  private readonly logger = new Logger('Push');

  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    for (const m of mensajes)
      this.logger.log(
        `→ ${m.tokens.length} dispositivos: ${m.titulo} — ${m.cuerpo}`,
      );
    return Promise.resolve({ tokensInvalidos: [] });
  }
}
