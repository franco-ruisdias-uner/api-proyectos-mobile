import {
  Notificador,
  type MensajePush,
  type ResultadoEnvio,
} from './notificador.js';

/** Para los tests: guarda lo que "se mandó" y puede simular tokens inválidos o una falla. */
export class NotificadorMemoria extends Notificador {
  readonly enviadas: MensajePush[] = [];
  private readonly invalidos = new Set<string>();
  private fallar = false;

  enviar(mensajes: MensajePush[]): Promise<ResultadoEnvio> {
    if (this.fallar) {
      this.fallar = false;
      return Promise.reject(new Error('Falla simulada del proveedor de push'));
    }
    this.enviadas.push(...mensajes);
    return Promise.resolve({
      tokensInvalidos: mensajes
        .map((m) => m.tokenExpo)
        .filter((t) => this.invalidos.has(t)),
    });
  }

  marcarInvalido(tokenExpo: string): void {
    this.invalidos.add(tokenExpo);
  }

  fallarProximoEnvio(): void {
    this.fallar = true;
  }

  limpiar(): void {
    this.enviadas.length = 0;
    this.invalidos.clear();
    this.fallar = false;
  }
}
