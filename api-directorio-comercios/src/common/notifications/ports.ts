/** Una push para uno o varios teléfonos (AGENTS §19.2). */
export interface MensajePush {
  tokens: string[];
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}

export type Plataforma = 'ios' | 'android';

/** Lo que completan los alumnos (1): dónde viven los tokens de Expo. */
export interface AlmacenTokensPush {
  guardar(usuarioId: string, tokenExpo: string, plataforma: Plataforma): Promise<void>;
  borrar(tokenExpo: string): Promise<void>;
  tokensDe(usuarioIds: string[]): Promise<string[]>;
  descartar(tokens: string[]): Promise<void>;
}

/** Lo que completan los alumnos (2): cómo se mandan. */
export interface EnviadorPush {
  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }>;
}

export const ALMACEN_TOKENS_PUSH = Symbol('ALMACEN_TOKENS_PUSH');
export const ENVIADOR_PUSH = Symbol('ENVIADOR_PUSH');

/** Lo que decide la API: el texto y a qué pantalla lleva. */
export interface Aviso {
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}
