// Avisos a usuarios (AGENTS §9 y §19): es lo único que usa el dominio. Respeta avisosActivos,
// busca los tokens en el almacén, manda sin bloquear la respuesta, loguea los errores sin romper
// el pedido y descarta los tokens que el proveedor da por muertos. Se llama después de confirmar
// la transacción.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { Usuario } from '../../modules/users/user.entity.js';
import {
  ALMACEN_TOKENS_PUSH,
  ENVIADOR_PUSH,
  PuertoSinImplementar,
  type AlmacenTokensPush,
  type EnviadorPush,
} from './ports.js';

export interface Aviso {
  titulo: string;
  cuerpo: string;
  datos?: Record<string, string>;
}

@Injectable()
export class Avisos {
  private readonly logger = new Logger('Avisos');
  private readonly pendientes = new Set<Promise<void>>();

  constructor(
    @Inject(ALMACEN_TOKENS_PUSH) private readonly almacen: AlmacenTokensPush,
    @Inject(ENVIADOR_PUSH) private readonly enviador: EnviadorPush,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  /**
   * Manda el aviso a los dispositivos de esos usuarios que tienen los avisos activos, en segundo
   * plano. Devuelve a cuántos dispositivos se mandó. Un error del almacén o del enviador se
   * loguea y no rompe el pedido, salvo con `propagar` (la push de prueba).
   */
  async avisar(
    usuarioIds: string[],
    aviso: Aviso,
    opciones: { propagar?: boolean } = {},
  ): Promise<number> {
    const ids = [...new Set(usuarioIds)];
    if (ids.length === 0) return 0;
    const conAvisos = await this.usuarios.find({
      where: { id: In(ids), avisosActivos: true },
      select: { id: true },
    });
    if (conAvisos.length === 0) return 0;
    let tokens: string[];
    try {
      tokens = [
        ...new Set(await this.almacen.tokensDe(conAvisos.map((u) => u.id))),
      ].sort();
    } catch (error) {
      if (opciones.propagar) throw error;
      this.registrarFalla(error, aviso, conAvisos.length);
      return 0;
    }
    if (tokens.length === 0) return 0;
    this.enSegundoPlano(this.enviar(tokens, aviso, conAvisos.length));
    return tokens.length;
  }

  /** Para los tests y el apagado: espera a que terminen los envíos en curso. */
  async esperarEnvios(): Promise<void> {
    while (this.pendientes.size > 0) await Promise.all(this.pendientes);
  }

  private async enviar(
    tokens: string[],
    aviso: Aviso,
    usuarios: number,
  ): Promise<void> {
    try {
      const { tokensInvalidos } = await this.enviador.enviar([
        {
          tokens,
          titulo: aviso.titulo,
          cuerpo: aviso.cuerpo,
          datos: aviso.datos ?? {},
        },
      ]);
      if (tokensInvalidos.length > 0) {
        await this.almacen.descartar(tokensInvalidos);
        this.logger.log(
          `Se descartaron ${tokensInvalidos.length} dispositivos dados de baja`,
        );
      }
    } catch (error) {
      this.registrarFalla(error, aviso, usuarios);
    }
  }

  private registrarFalla(error: unknown, aviso: Aviso, usuarios: number): void {
    if (error instanceof PuertoSinImplementar)
      this.logger.log(
        `Push pendiente de implementar: ${aviso.titulo} → ${usuarios} usuarios`,
      );
    else
      this.logger.warn(
        `No se pudieron mandar los avisos: ${(error as Error).message}`,
      );
  }

  private enSegundoPlano(tarea: Promise<void>): void {
    this.pendientes.add(tarea);
    void tarea.finally(() => this.pendientes.delete(tarea));
  }
}
