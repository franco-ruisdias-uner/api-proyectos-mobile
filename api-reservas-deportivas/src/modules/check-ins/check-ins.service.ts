import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import type { Reserva } from '../../../contract/types.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { esIdDe } from '../../common/ids/ids.js';
import { Reloj } from '../../common/clock/clock.js';
import { aContrato } from '../bookings/bookings.mapper.js';
import { ReservaEntidad } from '../slots/reserva.entity.js';
import { UsuarioEntidad } from '../users/user.entity.js';
import type { RegistrarIngresoDto } from './dto/check-ins.dto.js';
import { decidirAusente, decidirIngreso } from './rules/check-in.js';

@Injectable()
export class IngresosServicio {
  constructor(
    private readonly reloj: Reloj,
    private readonly dataSource: DataSource,
    @InjectRepository(ReservaEntidad)
    private readonly reservas: Repository<ReservaEntidad>,
  ) {}

  /** R14. El cambio es condicional: con dos lecturas del mismo QR, sólo una ingresa. */
  async registrarIngreso(dto: RegistrarIngresoDto): Promise<Reserva> {
    const reserva = await this.reservas.findOneBy({
      codigoQr: dto.codigoQr.trim().toUpperCase(),
    });
    if (!reserva) throw new ErrorApi('CODIGO_INVALIDO');
    const ahora = this.reloj.ahora();
    const error = decidirIngreso({
      ...reserva,
      espacioPedido: dto.espacioId,
      ahora,
    });
    if (error) throw new ErrorApi(error);

    const cambio = await this.reservas.update(
      { id: reserva.id, estado: 'confirmada' },
      { estado: 'cumplida', ingresoEn: ahora },
    );
    // Otro pedido llegó primero.
    if (cambio.affected !== 1) throw new ErrorApi('INGRESO_YA_REGISTRADO');
    return aContrato(await this.reservas.findOneByOrFail({ id: reserva.id }));
  }

  /** R15. Suma 1 a `ausencias` del dueño sólo si este pedido fue el que cambió el estado. */
  async marcarAusente(id: string): Promise<Reserva> {
    const reserva = esIdDe('res', id)
      ? await this.reservas.findOneBy({ id })
      : null;
    if (!reserva) throw new ErrorApi('RESERVA_NO_ENCONTRADA');
    const decision = decidirAusente({ ...reserva, ahora: this.reloj.ahora() });
    if ('error' in decision) throw new ErrorApi(decision.error);
    if (decision.accion === 'sin-cambios') return aContrato(reserva);

    await this.dataSource.transaction(async (m) => {
      const cambio = await m
        .getRepository(ReservaEntidad)
        .update(
          { id: reserva.id, estado: 'confirmada' },
          { estado: 'ausente' },
        );
      if (cambio.affected === 1)
        await m
          .getRepository(UsuarioEntidad)
          .increment({ id: reserva.usuarioId }, 'ausencias', 1);
    });
    return aContrato(await this.reservas.findOneByOrFail({ id }));
  }
}
