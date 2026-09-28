import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Dispositivo, PruebaNotificacion } from '../../../contrato/api.js';
import { esViolacionDeUnicidad } from '../../comun/db/unicidad.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { AvisosServicio } from './avisos.servicio.js';
import { DispositivoEntidad } from './dispositivo.entidad.js';
import type { RegistrarDispositivoDto } from './dto/registrar-dispositivo.dto.js';

const aContrato = (d: DispositivoEntidad): Dispositivo => ({
  tokenExpo: d.tokenExpo,
  plataforma: d.plataforma,
});

@Injectable()
export class DispositivosServicio {
  constructor(
    @InjectRepository(DispositivoEntidad) private readonly repo: Repository<DispositivoEntidad>,
    private readonly reloj: Reloj,
    private readonly avisos: AvisosServicio,
  ) {}

  /**
   * Idempotente por token. Si el token era de otro usuario (otra cuenta en el mismo teléfono),
   * pasa al actual. Devuelve si se creó.
   */
  async registrar(
    usuarioId: string,
    dto: RegistrarDispositivoDto,
  ): Promise<{ dispositivo: Dispositivo; nuevo: boolean }> {
    const existente = await this.repo.findOneBy({ tokenExpo: dto.tokenExpo });
    if (!existente) {
      const dispositivo = this.repo.create({ ...dto, usuarioId, registradoEn: this.reloj.ahora() });
      try {
        await this.repo.insert(dispositivo);
        return { dispositivo: aContrato(dispositivo), nuevo: true };
      } catch (error) {
        // Dos registros simultáneos del mismo token: el segundo actualiza.
        if (!esViolacionDeUnicidad(error)) throw error;
      }
    }
    await this.repo.update({ tokenExpo: dto.tokenExpo }, { usuarioId, plataforma: dto.plataforma });
    return {
      dispositivo: aContrato(await this.repo.findOneByOrFail({ tokenExpo: dto.tokenExpo })),
      nuevo: false,
    };
  }

  /** Sólo borra si el token es del usuario; si no existe o es de otro, no hace nada. */
  async darDeBaja(usuarioId: string, tokenExpo: string): Promise<void> {
    await this.repo.delete({ tokenExpo, usuarioId });
  }

  async prueba(usuarioId: string): Promise<PruebaNotificacion> {
    const enviadas = await this.avisos.avisar([usuarioId], {
      titulo: 'Mi Ciudad',
      cuerpo: '¡Las notificaciones funcionan! 🎉',
      datos: { tipo: 'prueba' },
    });
    return { enviadas };
  }
}
