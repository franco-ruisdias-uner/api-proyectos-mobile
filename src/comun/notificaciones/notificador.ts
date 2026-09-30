/** Una push para un dispositivo. */
export interface MensajePush {
  tokenExpo: string;
  titulo: string;
  cuerpo: string;
  datos?: Record<string, unknown>;
}

export interface ResultadoDeEnvio {
  /** Tokens que Expo dice que ya no sirven: se borran (AGENTS §9). */
  tokensInvalidos: string[];
}

/** Puerto de envío de push (AGENTS §9). */
export abstract class Notificador {
  abstract enviar(mensajes: MensajePush[]): Promise<ResultadoDeEnvio>;
}
