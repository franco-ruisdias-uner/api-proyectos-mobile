/** Una push para uno o varios teléfonos. */
export interface MensajePush {
  tokens: string[];
  titulo: string;
  cuerpo: string;
  datos?: Record<string, unknown>;
}

export interface ResultadoEnvio {
  /** Tokens que Expo informó como dados de baja: se borran. */
  tokensInvalidos: string[];
}

/** Puerto de envío de push (AGENTS §9). */
export abstract class Notificador {
  abstract enviar(mensajes: MensajePush[]): Promise<ResultadoEnvio>;
}
