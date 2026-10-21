import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ALMACEN_TOKENS_PUSH,
  ENVIADOR_PUSH,
  PendienteDeImplementar,
  type AlmacenTokensPush,
  type EnviadorPush,
} from './ports.js';

export interface Aviso {
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}

/**
 * Lo único que usa el dominio para mandar push (AGENTS §9 y §19.2). Decide a quién; guardar los
 * tokens y mandar los mensajes lo hacen los puertos. Se llama después de confirmar la transacción
 * y no se espera: un error del almacén o del enviador se loguea y no rompe el pedido.
 * (El interruptor `avisosActivos` no existe en este PRD: especificación D9.)
 */
@Injectable()
export class AvisosServicio {
  private readonly log = new Logger('Avisos');
  private readonly pendientes = new Set<Promise<void>>();

  constructor(
    @Inject(ALMACEN_TOKENS_PUSH) private readonly almacen: AlmacenTokensPush,
    @Inject(ENVIADOR_PUSH) private readonly enviador: EnviadorPush,
  ) {}

  /** Dispara el envío en segundo plano. */
  avisar(usuarioIds: string[], aviso: Aviso): void {
    const ids = [...new Set(usuarioIds)];
    if (ids.length === 0) return;
    const envio = this.enviar(ids, aviso).finally(() => this.pendientes.delete(envio));
    this.pendientes.add(envio);
  }

  private async enviar(usuarioIds: string[], aviso: Aviso): Promise<void> {
    try {
      const tokens = await this.almacen.tokensDe(usuarioIds);
      if (tokens.length === 0) return;
      const { tokensInvalidos } = await this.enviador.enviar([{ tokens, ...aviso }]);
      if (tokensInvalidos.length > 0) await this.almacen.descartar(tokensInvalidos);
    } catch (error) {
      if (error instanceof PendienteDeImplementar) {
        this.log.log(`Push pendiente de implementar: ${aviso.titulo} → ${usuarioIds.length} usuarios`);
      } else {
        this.log.warn(`No se pudo mandar la push: ${(error as Error).message}`);
      }
    }
  }

  /** Para los tests: espera a que terminen los envíos en curso. */
  async esperarPendientes(): Promise<void> {
    await Promise.all(this.pendientes);
  }
}
