import { Injectable, Logger } from '@nestjs/common';
import type { EnviadorPush, MensajePush } from '../comun/notificaciones/puertos.js';

/** `NOTIFICACIONES=registro`: no manda nada, sólo lo escribe en el log. */
@Injectable()
export class EnviadorRegistro implements EnviadorPush {
  private readonly log = new Logger('Notificaciones');

  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    for (const m of mensajes) {
      this.log.log(`Push a ${m.tokens.length} teléfono(s): «${m.titulo}» — ${m.cuerpo}`);
    }
    return Promise.resolve({ tokensInvalidos: [] });
  }
}
