import {
  AlmacenTokensPush,
  EnviadorPush,
  type MensajePush,
  type Plataforma,
} from '../../src/common/notifications/ports.js';

/** Doble en memoria del almacén de tokens (AGENTS §19.2): no depende de ninguna implementación. */
export class AlmacenTokensMemoria extends AlmacenTokensPush {
  private readonly tokens = new Map<string, { usuarioId: string; plataforma: Plataforma }>();

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
      [...this.tokens].filter(([, t]) => usuarioIds.includes(t.usuarioId)).map(([token]) => token),
    );
  }

  descartar(tokens: string[]): Promise<void> {
    for (const t of tokens) this.tokens.delete(t);
    return Promise.resolve();
  }
}

/** Lo que "se mandó" a un teléfono. */
export interface PushEnviada {
  tokenExpo: string;
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}

/** Doble en memoria del enviador: guarda lo que `Avisos` decidió mandar. */
export class EnviadorMemoria extends EnviadorPush {
  readonly mensajes: MensajePush[] = [];
  /** Tokens que el test quiere que Expo informe como inválidos. */
  readonly invalidos = new Set<string>();
  fallar = false;

  /** Una entrada por teléfono. */
  get enviadas(): PushEnviada[] {
    return this.mensajes.flatMap((m) =>
      m.tokens.map((tokenExpo) => ({
        tokenExpo,
        titulo: m.titulo,
        cuerpo: m.cuerpo,
        datos: m.datos,
      })),
    );
  }

  enviar(mensajes: MensajePush[]): Promise<{ tokensInvalidos: string[] }> {
    if (this.fallar) return Promise.reject(new Error('Expo no responde (simulado)'));
    this.mensajes.push(...mensajes);
    return Promise.resolve({
      tokensInvalidos: mensajes.flatMap((m) => m.tokens).filter((t) => this.invalidos.has(t)),
    });
  }

  vaciar(): void {
    this.mensajes.length = 0;
  }
}
