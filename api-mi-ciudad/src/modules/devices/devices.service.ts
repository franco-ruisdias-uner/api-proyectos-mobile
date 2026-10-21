import { Inject, Injectable } from '@nestjs/common';
import type { Dispositivo, PruebaNotificacion } from '../../../contract/api.js';
import { AvisosServicio } from '../../common/notifications/notices.service.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import {
  ALMACEN_TOKENS_PUSH,
  PendienteDeImplementar,
  type AlmacenTokensPush,
} from '../../common/notifications/ports.js';
import type { RegistrarDispositivoDto } from './dto/register-device.dto.js';

/** Mientras la parte de los alumnos está vacía, los endpoints responden 501 (AGENTS §19.3). */
async function o501<T>(accion: () => Promise<T>): Promise<T> {
  try {
    return await accion();
  } catch (error) {
    if (error instanceof PendienteDeImplementar) throw new ErrorApi('NO_IMPLEMENTADO');
    throw error;
  }
}

@Injectable()
export class DispositivosServicio {
  constructor(
    @Inject(ALMACEN_TOKENS_PUSH) private readonly almacen: AlmacenTokensPush,
    private readonly avisos: AvisosServicio,
  ) {}

  /** Idempotente por token. Si era de otro usuario, pasa al actual. Devuelve si es nuevo. */
  async registrar(
    usuarioId: string,
    dto: RegistrarDispositivoDto,
  ): Promise<{ dispositivo: Dispositivo; nuevo: boolean }> {
    const { nuevo } = await o501(() => this.almacen.guardar(usuarioId, dto.tokenExpo, dto.plataforma));
    return { dispositivo: { tokenExpo: dto.tokenExpo, plataforma: dto.plataforma }, nuevo };
  }

  /** Sólo borra si el token es del usuario; si no existe o es de otro, no hace nada. */
  async darDeBaja(usuarioId: string, tokenExpo: string): Promise<void> {
    const propios = await o501(() => this.almacen.tokensDe([usuarioId]));
    if (propios.includes(tokenExpo)) await o501(() => this.almacen.borrar(tokenExpo));
  }

  async prueba(usuarioId: string): Promise<PruebaNotificacion> {
    const tokens = await o501(() => this.almacen.tokensDe([usuarioId]));
    if (tokens.length === 0) return { enviadas: 0 };
    this.avisos.avisar([usuarioId], {
      titulo: 'Mi Ciudad',
      cuerpo: '¡Las notificaciones funcionan! 🎉',
      datos: { tipo: 'prueba' },
    });
    return { enviadas: tokens.length };
  }
}
