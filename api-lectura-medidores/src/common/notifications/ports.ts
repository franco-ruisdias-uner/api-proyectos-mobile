// Notificaciones push en dos puertos (AGENTS §19.2). El dominio usa sólo `Avisos`.

export type Plataforma = 'ios' | 'android';

export interface MensajePush {
  tokens: string[];
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}

/** Dónde viven los tokens de Expo de cada usuario. */
export abstract class AlmacenTokensPush {
  abstract guardar(
    usuarioId: string,
    tokenExpo: string,
    plataforma: Plataforma,
  ): Promise<void>;
  abstract borrar(tokenExpo: string): Promise<void>;
  abstract tokensDe(usuarioIds: string[]): Promise<string[]>;
  abstract descartar(tokens: string[]): Promise<void>;
}

/** Cómo se mandan las push. */
export abstract class EnviadorPush {
  abstract enviar(
    mensajes: MensajePush[],
  ): Promise<{ tokensInvalidos: string[] }>;
}
