import { Logger } from '@nestjs/common';
import { EnviadorPush, type MensajePush } from './ports.js';

/** No manda nada: escribe en el log lo que habría mandado. */
export class EnviadorRegistro extends EnviadorPush {
  private readonly log = new Logger('Push');

  async enviar(
    mensajes: MensajePush[],
  ): Promise<{ tokensInvalidos: string[] }> {
    for (const m of mensajes) {
      this.log.log(
        `"${m.titulo}: ${m.cuerpo}" → ${m.tokens.length} dispositivo(s)`,
      );
    }
    return { tokensInvalidos: [] };
  }
}
