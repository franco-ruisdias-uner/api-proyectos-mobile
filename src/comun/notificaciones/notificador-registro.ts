import { Injectable, Logger } from '@nestjs/common';
import { type MensajePush, Notificador, type ResultadoDeEnvio } from './notificador.js';

/** NOTIFICACIONES=registro: no manda nada, sólo lo escribe en el log. */
@Injectable()
export class NotificadorRegistro extends Notificador {
  private readonly registro = new Logger('Push');

  enviar(mensajes: MensajePush[]): Promise<ResultadoDeEnvio> {
    for (const m of mensajes) {
      this.registro.log(`[sin enviar] ${m.tokenExpo} — ${m.titulo}: ${m.cuerpo}`);
    }
    return Promise.resolve({ tokensInvalidos: [] });
  }
}
