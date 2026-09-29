// Puerto de envío de push (AGENTS §9). Implementaciones: Expo, registro (log) y memoria (tests).

export interface MensajePush {
  tokenExpo: string;
  titulo: string;
  cuerpo: string;
  /** Datos para que la app abra la pantalla que corresponde al tocar la notificación. */
  datos?: Record<string, string>;
}

export interface ResultadoEnvio {
  /** Tokens que el proveedor informó como dados de baja: se borran. */
  tokensInvalidos: string[];
}

/** Clase abstracta para usarla como token de Nest. */
export abstract class Notificador {
  abstract enviar(mensajes: MensajePush[]): Promise<ResultadoEnvio>;
}
