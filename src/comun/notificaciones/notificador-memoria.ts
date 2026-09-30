import { type MensajePush, Notificador, type ResultadoDeEnvio } from './notificador.js';

/** Para los tests: guarda lo que "se mandó" para poder verificarlo. */
export class NotificadorMemoria extends Notificador {
  readonly enviadas: MensajePush[] = [];
  /** Tokens que el test quiere que Expo informe como inválidos. */
  readonly invalidos = new Set<string>();
  fallar = false;

  enviar(mensajes: MensajePush[]): Promise<ResultadoDeEnvio> {
    if (this.fallar) return Promise.reject(new Error('Expo no responde (simulado)'));
    this.enviadas.push(...mensajes);
    return Promise.resolve({
      tokensInvalidos: mensajes.map((m) => m.tokenExpo).filter((t) => this.invalidos.has(t)),
    });
  }

  vaciar(): void {
    this.enviadas.length = 0;
  }
}
