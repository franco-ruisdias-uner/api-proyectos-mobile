import { Logger } from '@nestjs/common';
import type { EnviadorPush, MensajePush } from './puertos.js';

/** No manda nada: sólo escribe en el log lo que habría mandado (NOTIFICACIONES=registro). */
export class EnviadorRegistro implements EnviadorPush {
  private readonly logger = new Logger('Push');

  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    for (const m of mensajes) {
      this.logger.log(`Push (sólo registro): "${m.titulo}" → ${m.tokens.length} dispositivo(s)`);
    }
    return Promise.resolve({ tokensInvalidos: [] });
  }
}
