import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { esViolacionDeUnicidad } from '../../comun/db/unicidad.js';
import { ServicioAvisos } from '../../comun/notificaciones/avisos.servicio.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import type { Usuario } from '../usuarios/usuario.entidad.js';
import { Dispositivo } from './dispositivo.entidad.js';
import type { RegistrarDispositivoDto } from './dto/registrar-dispositivo.dto.js';

@Injectable()
export class ServicioDispositivos {
  constructor(
    @InjectRepository(Dispositivo)
    private readonly dispositivos: Repository<Dispositivo>,
    private readonly avisos: ServicioAvisos,
    private readonly reloj: Reloj,
  ) {}

  /**
   * Idempotente por token. Si el token era de otro usuario, pasa al actual (el teléfono cambió
   * de cuenta). `creado` es false cuando ya estaba registrado para este mismo usuario.
   */
  async registrar(
    usuario: Usuario,
    dto: RegistrarDispositivoDto,
    reintento = false,
  ): Promise<{ dispositivo: Dispositivo; creado: boolean }> {
    const existente = await this.dispositivos.findOneBy({
      tokenExpo: dto.tokenExpo,
    });
    if (existente?.usuarioId === usuario.id) {
      if (existente.plataforma !== dto.plataforma) {
        await this.dispositivos.update(
          { tokenExpo: dto.tokenExpo },
          { plataforma: dto.plataforma },
        );
        existente.plataforma = dto.plataforma;
      }
      return { dispositivo: existente, creado: false };
    }
    const dispositivo = this.dispositivos.create({
      tokenExpo: dto.tokenExpo,
      usuarioId: usuario.id,
      plataforma: dto.plataforma,
      creadoEn: this.reloj.ahora(),
    });
    if (existente) {
      await this.dispositivos.update(
        { tokenExpo: dto.tokenExpo },
        {
          usuarioId: usuario.id,
          plataforma: dto.plataforma,
          creadoEn: dispositivo.creadoEn,
        },
      );
      return { dispositivo, creado: true };
    }
    try {
      await this.dispositivos.insert(dispositivo);
      return { dispositivo, creado: true };
    } catch (error) {
      // Dos registros simultáneos del mismo token: el segundo encuentra el del primero.
      if (esViolacionDeUnicidad(error) && !reintento)
        return this.registrar(usuario, dto, true);
      throw error;
    }
  }

  /** Sólo borra el del propio usuario. Si no está (o es de otro), no hace nada. */
  async darDeBaja(usuario: Usuario, tokenExpo: string): Promise<void> {
    await this.dispositivos.delete({ tokenExpo, usuarioId: usuario.id });
  }

  async probar(usuario: Usuario): Promise<number> {
    return this.avisos.avisar([usuario.id], {
      titulo: 'Notificación de prueba',
      cuerpo: `Hola, ${usuario.nombre}: las notificaciones llegan bien a este teléfono.`,
      datos: { tipo: 'prueba' },
    });
  }
}
