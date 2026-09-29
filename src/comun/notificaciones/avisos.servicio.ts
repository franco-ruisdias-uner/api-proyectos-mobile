// Avisos a usuarios (AGENTS §9): respeta avisosActivos, manda sin bloquear la respuesta, loguea
// los errores sin romper el pedido y borra los tokens que el proveedor da por muertos.
// Se llama después de confirmar la transacción.
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { Dispositivo } from '../../modulos/dispositivos/dispositivo.entidad.js';
import { Usuario } from '../../modulos/usuarios/usuario.entidad.js';
import { Notificador, type MensajePush } from './notificador.js';

export interface Aviso {
  titulo: string;
  cuerpo: string;
  datos?: Record<string, string>;
}

@Injectable()
export class ServicioAvisos {
  private readonly logger = new Logger('Avisos');
  private readonly pendientes = new Set<Promise<void>>();

  constructor(
    private readonly notificador: Notificador,
    @InjectRepository(Dispositivo)
    private readonly dispositivos: Repository<Dispositivo>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  /**
   * Arma los mensajes para los dispositivos de esos usuarios que tienen los avisos activos y
   * los manda en segundo plano. Devuelve a cuántos dispositivos se mandó.
   */
  async avisar(usuarioIds: string[], aviso: Aviso): Promise<number> {
    const ids = [...new Set(usuarioIds)];
    if (ids.length === 0) return 0;
    const conAvisos = await this.usuarios.find({
      where: { id: In(ids), avisosActivos: true },
      select: { id: true },
    });
    if (conAvisos.length === 0) return 0;
    const dispositivos = await this.dispositivos.find({
      where: { usuarioId: In(conAvisos.map((u) => u.id)) },
      order: { tokenExpo: 'ASC' },
    });
    const mensajes: MensajePush[] = dispositivos.map((d) => ({
      tokenExpo: d.tokenExpo,
      ...aviso,
    }));
    if (mensajes.length > 0) this.enSegundoPlano(this.enviar(mensajes));
    return mensajes.length;
  }

  /** Para los tests y el apagado: espera a que terminen los envíos en curso. */
  async esperarEnvios(): Promise<void> {
    while (this.pendientes.size > 0) await Promise.all(this.pendientes);
  }

  private async enviar(mensajes: MensajePush[]): Promise<void> {
    try {
      const { tokensInvalidos } = await this.notificador.enviar(mensajes);
      if (tokensInvalidos.length > 0) {
        await this.dispositivos.delete({ tokenExpo: In(tokensInvalidos) });
        this.logger.log(
          `Se borraron ${tokensInvalidos.length} dispositivos dados de baja`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `No se pudieron mandar los avisos: ${(error as Error).message}`,
      );
    }
  }

  private enSegundoPlano(tarea: Promise<void>): void {
    this.pendientes.add(tarea);
    void tarea.finally(() => this.pendientes.delete(tarea));
  }
}
