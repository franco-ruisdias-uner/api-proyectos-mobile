import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Notificador } from '../../comun/notificaciones/notificador.js';
import { DispositivoEntidad } from './dispositivo.entidad.js';

export interface Aviso {
  titulo: string;
  cuerpo: string;
  datos?: Record<string, unknown>;
}

/**
 * Manda push a los teléfonos de un grupo de usuarios (AGENTS §9). Se llama después de confirmar
 * la transacción y no se espera: un error de Expo se loguea y no rompe el pedido.
 */
@Injectable()
export class AvisosServicio {
  private readonly log = new Logger('Avisos');
  private readonly pendientes = new Set<Promise<void>>();

  constructor(
    @InjectRepository(DispositivoEntidad) private readonly repo: Repository<DispositivoEntidad>,
    private readonly notificador: Notificador,
  ) {}

  /** Dispara el envío en segundo plano y devuelve a cuántos teléfonos va. */
  async avisar(usuarioIds: string[], aviso: Aviso): Promise<number> {
    if (usuarioIds.length === 0) return 0;
    const dispositivos = await this.repo.findBy({ usuarioId: In([...new Set(usuarioIds)]) });
    if (dispositivos.length === 0) return 0;
    const tokens = dispositivos.map((d) => d.tokenExpo);
    const envio = this.enviar(tokens, aviso).finally(() => this.pendientes.delete(envio));
    this.pendientes.add(envio);
    return tokens.length;
  }

  private async enviar(tokens: string[], aviso: Aviso): Promise<void> {
    try {
      const { tokensInvalidos } = await this.notificador.enviar([{ tokens, ...aviso }]);
      if (tokensInvalidos.length > 0) await this.repo.delete({ tokenExpo: In(tokensInvalidos) });
    } catch (error) {
      this.log.warn(`No se pudo mandar la push: ${(error as Error).message}`);
    }
  }

  /** Para los tests: espera a que terminen los envíos en curso. */
  async esperarPendientes(): Promise<void> {
    await Promise.all(this.pendientes);
  }
}
