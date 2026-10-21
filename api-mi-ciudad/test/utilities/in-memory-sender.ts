import type { EnviadorPush, MensajePush } from '../../src/common/notifications/ports.js';

/** Doble del enviador para tests: guarda lo que "se mandó" y no sale a internet. */
export class EnviadorMemoria implements EnviadorPush {
  readonly enviadas: MensajePush[] = [];
  /** Tokens que el test quiere que "Expo" informe como inválidos. */
  readonly invalidos = new Set<string>();

  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    this.enviadas.push(...mensajes);
    const tokensInvalidos = mensajes.flatMap((m) => m.tokens).filter((t) => this.invalidos.has(t));
    return Promise.resolve({ tokensInvalidos });
  }

  limpiar(): void {
    this.enviadas.length = 0;
  }
}
