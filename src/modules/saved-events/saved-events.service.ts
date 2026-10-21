import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Meta } from '../../../contract/api.js';
import type { Evento } from '../../../contract/types.js';
import { esViolacionDeUnicidad } from '../../common/db/uniqueness.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { esIdConPrefijo, nuevoId } from '../../common/ids/ids.js';
import { Reloj } from '../../common/clock/clock.js';
import { calcularPaginacion } from '../../common/response/pagination.js';
import type { PaginacionDto } from '../../common/response/pagination.dto.js';
import { AvisosServicio } from '../../common/notifications/notices.service.js';
import { EventoEntidad } from '../events/event.entity.js';
import { aContrato } from '../events/events.mapper.js';
import { estadoVisible, type EstadoGuardado } from '../events/rules/agenda.js';
import { EventoGuardadoEntidad } from './saved-event.entity.js';
import { avisoPorCambioDeEstado, sePuedeGuardar } from './rules/saved.js';

@Injectable()
export class EventosGuardadosServicio {
  constructor(
    @InjectRepository(EventoGuardadoEntidad) private readonly repo: Repository<EventoGuardadoEntidad>,
    @InjectRepository(EventoEntidad) private readonly eventos: Repository<EventoEntidad>,
    private readonly avisos: AvisosServicio,
    private readonly reloj: Reloj,
  ) {}

  /** Por `inicio` ascendente (desempate por id). Trae también los que ya terminaron o se cancelaron. */
  async listar(usuarioId: string, pedido: PaginacionDto): Promise<{ datos: Evento[]; meta: Meta }> {
    const ahora = this.reloj.ahora();
    const { pagina, porPagina, saltar } = calcularPaginacion(pedido);
    const [filas, total] = await this.repo.findAndCount({
      where: { usuarioId },
      relations: { evento: true },
      order: { evento: { inicio: 'ASC' }, id: 'ASC' },
      skip: saltar,
      take: porPagina,
    });
    const datos = filas.flatMap((f) => (f.evento ? [aContrato(f.evento, ahora)] : []));
    return { datos, meta: { total, pagina, porPagina } };
  }

  /**
   * R17. Repetir el pedido devuelve el evento con 200 sin mirar su estado (reintento de la cola);
   * dos pedidos a la vez: el índice único deja pasar uno solo.
   */
  async guardar(usuarioId: string, eventoId: string): Promise<{ evento: Evento; creado: boolean }> {
    const ahora = this.reloj.ahora();
    const evento = await this.buscarEvento(eventoId);
    if (!evento) throw new ErrorApi('EVENTO_NO_ENCONTRADO');
    const salida = (): Evento => aContrato(evento, ahora);
    if (await this.repo.existsBy({ usuarioId, eventoId })) return { evento: salida(), creado: false };
    if (!sePuedeGuardar(estadoVisible(evento.estado, evento.finEfectivo, ahora))) {
      throw new ErrorApi('EVENTO_NO_VIGENTE');
    }
    try {
      await this.repo.insert({ id: nuevoId('evg'), usuarioId, eventoId, creadoEn: ahora });
      return { evento: salida(), creado: true };
    } catch (error) {
      if (!esViolacionDeUnicidad(error)) throw error;
      return { evento: salida(), creado: false };
    }
  }

  /** Idempotente: si no estaba, o el id no existe, no pasa nada. */
  async quitar(usuarioId: string, eventoId: string): Promise<void> {
    if (!esIdConPrefijo(eventoId, 'evt')) return;
    await this.repo.delete({ usuarioId, eventoId });
  }

  /**
   * Especificación §7: después de cambiar el estado, push a quienes guardaron el evento. No espera
   * el envío ni falla el pedido si algo sale mal.
   */
  async avisarCambioDeEstado(evento: EventoEntidad, antes: EstadoGuardado): Promise<void> {
    const yaTermino = evento.finEfectivo.getTime() < this.reloj.ahora().getTime();
    const aviso = avisoPorCambioDeEstado(evento, antes, evento.estado, yaTermino);
    if (!aviso) return;
    const guardados = await this.repo.findBy({ eventoId: evento.id });
    this.avisos.avisar(
      guardados.map((g) => g.usuarioId),
      aviso,
    );
  }

  /** Alta desde la semilla, con el id del evento ya cargado. */
  async cargar(g: { usuarioId: string; eventoId: string; creadoEn: Date }): Promise<void> {
    await this.repo.insert({ id: nuevoId('evg'), ...g });
  }

  /** Por id exacto: en MySQL y MariaDB `evt-ABC` encontraría `evt-abc`. */
  private async buscarEvento(id: string): Promise<EventoEntidad | null> {
    if (!esIdConPrefijo(id, 'evt')) return null;
    const evento = await this.eventos.findOneBy({ id });
    return evento?.id === id ? evento : null;
  }
}
