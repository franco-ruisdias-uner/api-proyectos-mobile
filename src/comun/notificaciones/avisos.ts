import { Injectable, Logger } from '@nestjs/common';
import { AlmacenTokensPush, EnviadorPush } from './puertos.js';

export interface Aviso {
  titulo: string;
  cuerpo: string;
  datos?: Record<string, string>;
}

/**
 * Lo único que usa el dominio para avisar. Decide a quién y qué; el almacén de tokens y
 * el enviador hacen el resto. Nunca rompe el pedido: los errores van al log.
 * El `Usuario` de este PRD no tiene interruptor de avisos: se notifica siempre (D17).
 */
@Injectable()
export class Avisos {
  private readonly log = new Logger('Avisos');
  private readonly enCurso = new Set<Promise<void>>();

  constructor(
    private readonly almacen: AlmacenTokensPush,
    private readonly enviador: EnviadorPush,
  ) {}

  /**
   * Se llama después de confirmar la transacción. No bloquea la respuesta: el envío
   * sigue en segundo plano.
   */
  avisar(usuarioIds: string[], aviso: Aviso): void {
    const tarea = this.enviarAhora(usuarioIds, aviso).then(
      () => undefined,
      () => undefined,
    );
    this.enCurso.add(tarea);
    void tarea.finally(() => this.enCurso.delete(tarea));
  }

  /** Manda y espera. Devuelve a cuántos dispositivos se intentó mandar. */
  async enviarAhora(usuarioIds: string[], aviso: Aviso): Promise<number> {
    const destinatarios = [...new Set(usuarioIds)];
    if (destinatarios.length === 0) return 0;
    try {
      const tokens = await this.almacen.tokensDe(destinatarios);
      if (tokens.length === 0) return 0;
      const { tokensInvalidos } = await this.enviador.enviar([
        {
          tokens,
          titulo: aviso.titulo,
          cuerpo: aviso.cuerpo,
          datos: aviso.datos ?? {},
        },
      ]);
      if (tokensInvalidos.length > 0)
        await this.almacen.descartar(tokensInvalidos);
      return tokens.length;
    } catch (error) {
      this.log.error(
        `No se pudo mandar el aviso "${aviso.titulo}": ${String(error)}`,
      );
      return 0;
    }
  }

  /** Para los tests: espera a que terminen los envíos en segundo plano. */
  async esperarPendientes(): Promise<void> {
    while (this.enCurso.size > 0) await Promise.all(this.enCurso);
  }
}
