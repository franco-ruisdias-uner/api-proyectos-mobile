// Enviador que sólo escribe en el log (NOTIFICACIONES=registro): para desarrollar
// sin mandar push de verdad.
import { Logger } from '@nestjs/common';
import { EnviadorPush, type MensajePush } from './ports.js';

export class EnviadorRegistro extends EnviadorPush {
  private readonly logger = new Logger('Push');

  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    for (const m of mensajes) {
      this.logger.log(
        `«${m.titulo}» → ${m.tokens.length} dispositivo(s): ${m.cuerpo}`,
      );
    }
    return Promise.resolve({ tokensInvalidos: [] });
  }
}
