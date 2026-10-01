/** Una push para uno o varios teléfonos. */
export interface MensajePush {
  tokens: string[];
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}

export type PlataformaPush = 'ios' | 'android';

/** Lo que completan los alumnos (1): dónde viven los tokens de Expo (AGENTS §19.2). */
export interface AlmacenTokensPush {
  /**
   * Idempotente por token; si era de otro usuario, pasa al actual. Devuelve `nuevo: true` si el
   * token no existía (la API responde 201) y `false` si ya estaba (200).
   */
  guardar(usuarioId: string, tokenExpo: string, plataforma: PlataformaPush): Promise<{ nuevo: boolean }>;
  borrar(tokenExpo: string): Promise<void>;
  tokensDe(usuarioIds: string[]): Promise<string[]>;
  descartar(tokens: string[]): Promise<void>;
}

/** Lo que completan los alumnos (2): cómo se mandan las push. */
export interface EnviadorPush {
  /** Devuelve los tokens que Expo informó como dados de baja (`DeviceNotRegistered`). */
  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }>;
}

export const ALMACEN_TOKENS_PUSH = Symbol('ALMACEN_TOKENS_PUSH');
export const ENVIADOR_PUSH = Symbol('ENVIADOR_PUSH');

/** La parte que programan los alumnos todavía está vacía. */
export class PendienteDeImplementar extends Error {
  constructor(parte: string) {
    super(`Falta implementar: ${parte}`);
  }
}
