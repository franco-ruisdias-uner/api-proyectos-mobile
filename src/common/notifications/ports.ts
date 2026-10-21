// Los dos puertos de las notificaciones push (AGENTS §19.2). El dominio no los usa: llama a
// `Avisos`. Las implementaciones viven en `src/student-notifications/`.

export const PLATAFORMAS = ['android', 'ios'] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

/** Una notificación para varios teléfonos (los tokens de Expo). */
export interface MensajePush {
  tokens: string[];
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}

/** Dónde viven los tokens de Expo de cada usuario. */
export abstract class AlmacenTokensPush {
  /** Idempotente por token; si otro usuario lo tenía, pasa a `usuarioId`. */
  abstract guardar(usuarioId: string, tokenExpo: string, plataforma: Plataforma): Promise<void>;
  /** Idempotente: un token que no está no es un error. */
  abstract borrar(tokenExpo: string): Promise<void>;
  abstract tokensDe(usuarioIds: string[]): Promise<string[]>;
  /** Borra los tokens que Expo dijo que ya no sirven. */
  abstract descartar(tokens: string[]): Promise<void>;
}

/** Cómo se mandan a Expo. */
export abstract class EnviadorPush {
  abstract enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }>;
}
