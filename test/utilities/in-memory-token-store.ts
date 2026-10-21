import type { AlmacenTokensPush, PlataformaPush } from '../../src/common/notifications/ports.js';

/** Doble del almacén de tokens para tests: en memoria, un token pertenece a un solo usuario. */
export class AlmacenTokensMemoria implements AlmacenTokensPush {
  private readonly porToken = new Map<string, { usuarioId: string; plataforma: PlataformaPush }>();

  guardar(usuarioId: string, tokenExpo: string, plataforma: PlataformaPush): Promise<{ nuevo: boolean }> {
    const nuevo = !this.porToken.has(tokenExpo);
    this.porToken.set(tokenExpo, { usuarioId, plataforma });
    return Promise.resolve({ nuevo });
  }

  borrar(tokenExpo: string): Promise<void> {
    this.porToken.delete(tokenExpo);
    return Promise.resolve();
  }

  tokensDe(usuarioIds: string[]): Promise<string[]> {
    return Promise.resolve(
      [...this.porToken].filter(([, v]) => usuarioIds.includes(v.usuarioId)).map(([token]) => token),
    );
  }

  descartar(tokens: string[]): Promise<void> {
    tokens.forEach((t) => this.porToken.delete(t));
    return Promise.resolve();
  }

  /** Para verificar: todos los tokens guardados. */
  todos(): string[] {
    return [...this.porToken.keys()];
  }
}
