import { Logger } from '@nestjs/common';
import { Notificador, type MensajePush, type ResultadoEnvio } from './notificador.js';

/** `NOTIFICACIONES=registro`: no manda nada, sólo lo escribe en el log. */
export class NotificadorRegistro extends Notificador {
  private readonly log = new Logger('Notificaciones');

  enviar(mensajes: MensajePush[]): Promise<ResultadoEnvio> {
    for (const m of mensajes) {
      this.log.log(`Push a ${m.tokens.length} teléfono(s): «${m.titulo}» — ${m.cuerpo}`);
    }
    return Promise.resolve({ tokensInvalidos: [] });
  }
}
