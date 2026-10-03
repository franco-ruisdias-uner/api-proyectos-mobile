import type {
  AlmacenTokensPush,
  EnviadorPush,
  MensajePush,
  Plataforma,
} from '../../src/comun/notificaciones/puertos.js';

/** Enviador de mentira: guarda lo que "se mandó" (AGENTS §9). */
export class EnviadorMemoria implements EnviadorPush {
  enviados: MensajePush[] = [];
  /** Tokens que hay que responder como DeviceNotRegistered. */
  invalidos = new Set<string>();
  /** Si tiene un error, enviar lo tira (para probar que no rompe el pedido). */
  fallarCon: Error | null = null;

  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    if (this.fallarCon) return Promise.reject(this.fallarCon);
    this.enviados.push(...mensajes);
    const tokensInvalidos = mensajes.flatMap((m) => m.tokens).filter((t) => this.invalidos.has(t));
    return Promise.resolve({ tokensInvalidos });
  }

  limpiar(): void {
    this.enviados = [];
    this.invalidos.clear();
    this.fallarCon = null;
  }
}

/** Almacén de tokens en memoria, para los tests de `Avisos` sin base. */
export class AlmacenTokensMemoria implements AlmacenTokensPush {
  readonly tokens = new Map<string, { usuarioId: string; plataforma: Plataforma }>();

  guardar(usuarioId: string, tokenExpo: string, plataforma: Plataforma): Promise<void> {
    this.tokens.set(tokenExpo, { usuarioId, plataforma });
    return Promise.resolve();
  }
  borrar(tokenExpo: string): Promise<void> {
    this.tokens.delete(tokenExpo);
    return Promise.resolve();
  }
  tokensDe(usuarioIds: string[]): Promise<string[]> {
    return Promise.resolve(
      [...this.tokens]
        .filter(([, d]) => usuarioIds.includes(d.usuarioId))
        .map(([t]) => t)
        .sort(),
    );
  }
  descartar(tokens: string[]): Promise<void> {
    for (const t of tokens) this.tokens.delete(t);
    return Promise.resolve();
  }
}
