import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Dispositivo, PruebaDePush } from '../../../contrato/api.js';
import { type MensajePush, Notificador } from '../../comun/notificaciones/notificador.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { UsuarioEntidad } from '../usuarios/usuario.entidad.js';
import { DispositivoEntidad } from './dispositivo.entidad.js';
import type { RegistrarDispositivoDto } from './dto/registrar-dispositivo.dto.js';

export interface Notificacion {
  titulo: string;
  cuerpo: string;
  datos?: Record<string, unknown>;
}

@Injectable()
export class DispositivosServicio {
  private readonly registro = new Logger('Push');
  private readonly enCurso = new Set<Promise<void>>();

  constructor(
    @InjectRepository(DispositivoEntidad)
    private readonly dispositivos: Repository<DispositivoEntidad>,
    @InjectRepository(UsuarioEntidad) private readonly usuarios: Repository<UsuarioEntidad>,
    private readonly notificador: Notificador,
    private readonly reloj: Reloj,
  ) {}

  /** Idempotente por token; si otro usuario lo tenía, pasa al actual (AGENTS §9). */
  async registrar(usuarioId: string, dto: RegistrarDispositivoDto): Promise<Dispositivo> {
    await this.dispositivos.upsert(
      {
        tokenExpo: dto.tokenExpo,
        usuarioId,
        plataforma: dto.plataforma,
        registradoEn: this.reloj.ahora(),
      },
      ['tokenExpo'],
    );
    return { tokenExpo: dto.tokenExpo, plataforma: dto.plataforma };
  }

  /** Idempotente; sólo borra el token si es del usuario. */
  async darDeBaja(usuarioId: string, tokenExpo: string): Promise<void> {
    await this.dispositivos.delete({ tokenExpo, usuarioId });
  }

  /** Push de prueba a los dispositivos del usuario, si tiene los avisos activos. */
  async probar(usuarioId: string): Promise<PruebaDePush> {
    const mensajes = await this.mensajesPara([usuarioId], {
      titulo: 'Prueba de notificaciones',
      cuerpo: 'Si ves esto, las notificaciones de la app andan bien.',
      datos: { tipo: 'prueba' },
    });
    return { enviadas: await this.enviar(mensajes) };
  }

  /**
   * Notifica a esos usuarios (sólo a los que tienen avisosActivos) sin bloquear: se llama
   * después de confirmar la transacción, y un error de Expo se loguea y no rompe nada.
   */
  notificar(usuarioIds: string[], aviso: Notificacion): void {
    const envio = this.mensajesPara(usuarioIds, aviso)
      .then(async (mensajes) => {
        await this.enviar(mensajes);
      })
      .catch((error: unknown) => this.registro.error(`No se pudo notificar: ${String(error)}`))
      .finally(() => this.enCurso.delete(envio));
    this.enCurso.add(envio);
  }

  /** Para los tests: espera a que terminen los envíos en segundo plano. */
  async esperarEnvios(): Promise<void> {
    while (this.enCurso.size > 0) await Promise.all(this.enCurso);
  }

  private async mensajesPara(usuarioIds: string[], aviso: Notificacion): Promise<MensajePush[]> {
    if (usuarioIds.length === 0) return [];
    const conAvisos = await this.usuarios.find({
      select: { id: true },
      where: { id: In([...new Set(usuarioIds)]), avisosActivos: true },
    });
    if (conAvisos.length === 0) return [];
    const dispositivos = await this.dispositivos.find({
      where: { usuarioId: In(conAvisos.map((u) => u.id)) },
      order: { tokenExpo: 'ASC' },
    });
    return dispositivos.map((d) => ({
      tokenExpo: d.tokenExpo,
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo,
      datos: aviso.datos,
    }));
  }

  /** Devuelve a cuántos teléfonos se mandó (sin contar los tokens inválidos). */
  private async enviar(mensajes: MensajePush[]): Promise<number> {
    if (mensajes.length === 0) return 0;
    try {
      const { tokensInvalidos } = await this.notificador.enviar(mensajes);
      if (tokensInvalidos.length > 0) {
        await this.dispositivos.delete({ tokenExpo: In(tokensInvalidos) });
      }
      return mensajes.length - new Set(tokensInvalidos).size;
    } catch (error) {
      this.registro.error(`Falló el envío de push: ${String(error)}`);
      return 0;
    }
  }
}
