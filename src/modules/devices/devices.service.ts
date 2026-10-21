import { Inject, Injectable } from '@nestjs/common';
import { Avisos } from '../../common/notifications/notices.service.js';
import {
  ALMACEN_TOKENS_PUSH,
  type AlmacenTokensPush,
} from '../../common/notifications/ports.js';
import type { Usuario } from '../users/user.entity.js';
import type { RegistrarDispositivoDto } from './dto/register-device.dto.js';

@Injectable()
export class ServicioDispositivos {
  constructor(
    @Inject(ALMACEN_TOKENS_PUSH) private readonly almacen: AlmacenTokensPush,
    private readonly avisos: Avisos,
  ) {}

  /**
   * Idempotente por token. Si el token era de otro usuario, pasa al actual (el teléfono cambió
   * de cuenta). `creado` es false cuando ya estaba registrado para este mismo usuario.
   */
  async registrar(
    usuario: Usuario,
    dto: RegistrarDispositivoDto,
  ): Promise<{ creado: boolean }> {
    const propios = await this.almacen.tokensDe([usuario.id]);
    await this.almacen.guardar(usuario.id, dto.tokenExpo, dto.plataforma);
    return { creado: !propios.includes(dto.tokenExpo) };
  }

  /**
   * Da de baja el token sólo si es del propio usuario. Si no está (o es de otro), no hace nada.
   */
  async darDeBaja(usuario: Usuario, tokenExpo: string): Promise<void> {
    const propios = await this.almacen.tokensDe([usuario.id]);
    if (propios.includes(tokenExpo)) await this.almacen.borrar(tokenExpo);
  }

  async probar(usuario: Usuario): Promise<number> {
    return this.avisos.avisar(
      [usuario.id],
      {
        titulo: 'Notificación de prueba',
        cuerpo: `Hola, ${usuario.nombre}: las notificaciones llegan bien a este teléfono.`,
        datos: { tipo: 'prueba' },
      },
      { propagar: true },
    );
  }
}
