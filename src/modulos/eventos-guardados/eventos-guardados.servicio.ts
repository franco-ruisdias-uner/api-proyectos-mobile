import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Meta } from '../../../contrato/api.js';
import type { Evento } from '../../../contrato/tipos.js';
import { esViolacionDeUnicidad } from '../../comun/db/unicidad.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { esIdConPrefijo, nuevoId } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { calcularPaginacion } from '../../comun/respuesta/paginacion.js';
import type { PaginacionDto } from '../../comun/respuesta/paginacion.dto.js';
import { AvisosServicio } from '../dispositivos/avisos.servicio.js';
import { EventoEntidad } from '../eventos/evento.entidad.js';
import { aContrato } from '../eventos/eventos.mapeador.js';
import { estadoVisible, type EstadoGuardado } from '../eventos/reglas/agenda.js';
import { EventoGuardadoEntidad } from './evento-guardado.entidad.js';
import { avisoPorCambioDeEstado, sePuedeGuardar } from './reglas/guardado.js';

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
    await this.avisos.avisar(
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
