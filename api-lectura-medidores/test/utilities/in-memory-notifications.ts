import {
  AlmacenTokensPush,
  EnviadorPush,
  type MensajePush,
  type Plataforma,
} from '../../src/common/notifications/ports.js';

/** Doble del enviador: guarda lo que "se mandó". Se le pueden marcar tokens como inválidos. */
export class EnviadorMemoria extends EnviadorPush {
  readonly enviados: MensajePush[] = [];
  readonly invalidos = new Set<string>();
  fallar = false;

  async enviar(
    mensajes: MensajePush[],
  ): Promise<{ tokensInvalidos: string[] }> {
    if (this.fallar) throw new Error('Expo no responde (simulado)');
    this.enviados.push(...mensajes);
    return {
      tokensInvalidos: mensajes
        .flatMap((m) => m.tokens)
        .filter((t) => this.invalidos.has(t)),
    };
  }

  limpiar(): void {
    this.enviados.length = 0;
    this.invalidos.clear();
    this.fallar = false;
  }
}

/** Doble del almacén de tokens, en memoria. */
export class AlmacenTokensMemoria extends AlmacenTokensPush {
  readonly tokens = new Map<
    string,
    { usuarioId: string; plataforma: Plataforma }
  >();

  async guardar(
    usuarioId: string,
    tokenExpo: string,
    plataforma: Plataforma,
  ): Promise<void> {
    this.tokens.set(tokenExpo, { usuarioId, plataforma });
  }

  async borrar(tokenExpo: string): Promise<void> {
    this.tokens.delete(tokenExpo);
  }

  async tokensDe(usuarioIds: string[]): Promise<string[]> {
    return [...this.tokens.entries()]
      .filter(([, d]) => usuarioIds.includes(d.usuarioId))
      .map(([t]) => t)
      .sort();
  }

  async descartar(tokens: string[]): Promise<void> {
    for (const t of tokens) this.tokens.delete(t);
  }
}
