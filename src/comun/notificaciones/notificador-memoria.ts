import { Notificador, type MensajePush, type ResultadoEnvio } from './notificador.js';

/** Para tests: guarda lo que "se mandó" para que el test lo verifique. */
export class NotificadorMemoria extends Notificador {
  readonly enviadas: MensajePush[] = [];
  /** Tokens que el test quiere que "Expo" informe como inválidos. */
  readonly invalidos = new Set<string>();

  enviar(mensajes: MensajePush[]): Promise<ResultadoEnvio> {
    this.enviadas.push(...mensajes);
    const tokensInvalidos = mensajes.flatMap((m) => m.tokens).filter((t) => this.invalidos.has(t));
    return Promise.resolve({ tokensInvalidos });
  }

  limpiar(): void {
    this.enviadas.length = 0;
  }
}
