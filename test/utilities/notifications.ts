// Dobles en memoria de los dos puertos de push (AGENTS §19.2). Los tests de dominio
// verifican qué decidió `Avisos` (a quién y con qué texto), no lo que llegó a Expo.
import type {
  AlmacenTokensPush,
  EnviadorPush,
  MensajePush,
} from '../../src/common/notifications/ports.js';

export class EnviadorMemoria implements EnviadorPush {
  readonly enviados: MensajePush[] = [];
  /** Tokens que el próximo envío va a informar como inválidos. */
  invalidos: string[] = [];

  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    this.enviados.push(...mensajes);
    const tokensInvalidos = mensajes
      .flatMap((m) => m.tokens)
      .filter((t) => this.invalidos.includes(t));
    return Promise.resolve({ tokensInvalidos });
  }

  vaciar(): void {
    this.enviados.length = 0;
  }
}

export class AlmacenTokensMemoria implements AlmacenTokensPush {
  readonly tokens = new Map<
    string,
    { usuarioId: string; plataforma: 'ios' | 'android' }
  >();

  guardar(
    usuarioId: string,
    tokenExpo: string,
    plataforma: 'ios' | 'android',
  ): Promise<void> {
    this.tokens.set(tokenExpo, { usuarioId, plataforma });
    return Promise.resolve();
  }

  borrar(tokenExpo: string): Promise<void> {
    this.tokens.delete(tokenExpo);
    return Promise.resolve();
  }

  tokensDe(usuarioIds: string[]): Promise<string[]> {
    return Promise.resolve(
      [...this.tokens.entries()]
        .filter(([, d]) => usuarioIds.includes(d.usuarioId))
        .map(([t]) => t),
    );
  }

  descartar(tokens: string[]): Promise<void> {
    tokens.forEach((t) => this.tokens.delete(t));
    return Promise.resolve();
  }
}
