// Los dos puertos de las notificaciones (AGENTS §19.2). Los completan los alumnos: el dominio
// no los toca, sólo llama a Avisos.
import type { Plataforma } from '../../../contrato/api.js';

export interface MensajePush {
  tokens: string[];
  titulo: string;
  cuerpo: string;
  /** Datos para que la app abra la pantalla que corresponde al tocar la notificación. */
  datos: Record<string, string>;
}

/** Dónde viven los tokens de Expo de cada usuario. */
export interface AlmacenTokensPush {
  /** Idempotente por token; si lo tenía otro usuario, pasa a éste. */
  guardar(
    usuarioId: string,
    tokenExpo: string,
    plataforma: Plataforma,
  ): Promise<void>;
  borrar(tokenExpo: string): Promise<void>;
  tokensDe(usuarioIds: string[]): Promise<string[]>;
  descartar(tokens: string[]): Promise<void>;
}

/** Cómo se mandan las push. */
export interface EnviadorPush {
  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }>;
}

/** Tokens de inyección de Nest (las interfaces no existen en tiempo de ejecución). */
export const ALMACEN_TOKENS_PUSH = Symbol('ALMACEN_TOKENS_PUSH');
export const ENVIADOR_PUSH = Symbol('ENVIADOR_PUSH');

/** La implementación de ese puerto todavía no está programada: responde 501. */
export class PuertoSinImplementar extends Error {
  constructor(metodo: string) {
    super(`${metodo} todavía no está implementado`);
    this.name = 'PuertoSinImplementar';
  }
}
