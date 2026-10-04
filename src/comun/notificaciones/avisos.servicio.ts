// Lo único que usa el dominio para avisar (AGENTS §9 y §19.2). Decide a quién y con
// qué texto; busca tokens y manda sin bloquear la respuesta. Un error del almacén o
// del enviador se loguea y nunca rompe el pedido.
import { Injectable, Logger } from '@nestjs/common';
import { AlmacenTokensPush, EnviadorPush } from './puertos.js';

export interface Aviso {
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}

@Injectable()
export class Avisos {
  private readonly logger = new Logger('Avisos');
  private readonly enCurso = new Set<Promise<void>>();

  constructor(
    private readonly almacen: AlmacenTokensPush,
    private readonly enviador: EnviadorPush,
  ) {}

  /**
   * Avisa a esos usuarios. Llamalo después de confirmar la transacción: no espera el
   * envío. (Este PRD no tiene interruptor de avisos en el Usuario: D7.)
   */
  avisar(usuarioIds: string[], aviso: Aviso): void {
    const destinatarios = [...new Set(usuarioIds)];
    if (destinatarios.length === 0) return;
    const envio = this.enviar(destinatarios, aviso).finally(() =>
      this.enCurso.delete(envio),
    );
    this.enCurso.add(envio);
  }

  /** Espera los envíos que están en curso (tests y apagado ordenado). */
  async esperarEnvios(): Promise<void> {
    while (this.enCurso.size > 0) await Promise.all(this.enCurso);
  }

  private async enviar(usuarioIds: string[], aviso: Aviso): Promise<void> {
    try {
      const tokens = await this.almacen.tokensDe(usuarioIds);
      if (tokens.length === 0) return;
      const { tokensInvalidos } = await this.enviador.enviar([
        { tokens, ...aviso },
      ]);
      if (tokensInvalidos.length > 0)
        await this.almacen.descartar(tokensInvalidos);
    } catch (error) {
      this.logger.error(
        `No se pudo mandar el aviso «${aviso.titulo}»: ${(error as Error).message}`,
      );
    }
  }
}
