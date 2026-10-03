import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, In } from 'typeorm';
import { ErrorApi } from '../errores/error-api.js';
import { Usuario } from '../../modulos/usuarios/usuario.entidad.js';
import {
  ALMACEN_TOKENS_PUSH,
  type AlmacenTokensPush,
  type Aviso,
  ENVIADOR_PUSH,
  type EnviadorPush,
} from './puertos.js';

/**
 * Lo único que usa el dominio para notificar (AGENTS §19.2). Filtra por `avisosActivos`,
 * busca los tokens, manda y descarta los inválidos. Nunca rompe el pedido: los errores van al log.
 *
 * Se llama DESPUÉS de confirmar la transacción y sin esperar: `this.avisos.avisar(...)`.
 */
@Injectable()
export class Avisos {
  private readonly logger = new Logger('Avisos');
  private readonly pendientes = new Set<Promise<void>>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(ALMACEN_TOKENS_PUSH) private readonly almacen: AlmacenTokensPush,
    @Inject(ENVIADOR_PUSH) private readonly enviador: EnviadorPush,
  ) {}

  avisar(usuarioIds: string[], aviso: Aviso): void {
    const tarea = this.procesar(usuarioIds, aviso).finally(() => this.pendientes.delete(tarea));
    this.pendientes.add(tarea);
  }

  /** Para tests y para cerrar la app: espera los envíos en curso. */
  async esperarPendientes(): Promise<void> {
    while (this.pendientes.size > 0) await Promise.all(this.pendientes);
  }

  private async procesar(usuarioIds: string[], aviso: Aviso): Promise<void> {
    const unicos = [...new Set(usuarioIds)];
    try {
      if (unicos.length === 0) return;
      const conAvisos = await this.dataSource.getRepository(Usuario).find({
        select: { id: true },
        where: { id: In(unicos), avisosActivos: true },
      });
      const tokens = await this.almacen.tokensDe(conAvisos.map((u) => u.id));
      if (tokens.length === 0) return;
      const { tokensInvalidos } = await this.enviador.enviar([{ tokens, ...aviso }]);
      if (tokensInvalidos.length > 0) await this.almacen.descartar(tokensInvalidos);
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'NO_IMPLEMENTADO') {
        // Las piezas de los alumnos todavía están vacías: el flujo de la app sigue igual.
        this.logger.log(
          `Push pendiente de implementar: ${aviso.titulo} → ${unicos.length} usuarios`,
        );
        return;
      }
      this.logger.error(
        `No se pudo mandar el aviso "${aviso.titulo}": ${(error as Error).message}`,
      );
    }
  }
}
