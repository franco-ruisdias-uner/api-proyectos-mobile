import { Injectable, Logger } from '@nestjs/common';
import { ErrorApi } from '../errors/error-api.js';
import { AlmacenTokensPush, EnviadorPush } from './ports.js';

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

  /**
   * Manda y espera. Devuelve a cuántos dispositivos se intentó mandar. Si el almacén o el
   * enviador todavía están por hacer (AGENTS §19.3), lo deja en el log y sigue; con
   * `propagarPendiente` el error `NO_IMPLEMENTADO` sale para que el endpoint lo devuelva.
   */
  async enviarAhora(
    usuarioIds: string[],
    aviso: Aviso,
    opciones: { propagarPendiente?: boolean } = {},
  ): Promise<number> {
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
      if (error instanceof ErrorApi && error.codigo === 'NO_IMPLEMENTADO') {
        this.log.warn(
          `Push pendiente de implementar: ${aviso.titulo} → ${destinatarios.length} usuarios`,
        );
        if (opciones.propagarPendiente) throw error;
        return 0;
      }
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
