import { Injectable, Logger } from '@nestjs/common';
import { EnviadorPush, type MensajePush } from '../comun/notificaciones/puertos.js';

/** NOTIFICACIONES=registro: no manda nada, sólo lo escribe en el log. */
@Injectable()
export class EnviadorRegistro extends EnviadorPush {
  private readonly registro = new Logger('Push');

  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    for (const m of mensajes) {
      this.registro.log(`[sin enviar] ${m.tokens.length} teléfonos — ${m.titulo}: ${m.cuerpo}`);
    }
    return Promise.resolve({ tokensInvalidos: [] });
  }
}
