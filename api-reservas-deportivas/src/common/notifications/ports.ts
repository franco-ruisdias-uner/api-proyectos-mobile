// Los dos puertos de push (AGENTS §19.2). Son la parte que, al final del plan,
// programan los alumnos. El dominio nunca los usa directo: llama a Avisos.

export interface MensajePush {
  tokens: string[];
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}

export type Plataforma = 'ios' | 'android';

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
