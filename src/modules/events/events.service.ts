import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  And,
  type FindOperator,
  type FindOptionsWhere,
  LessThan,
  MoreThan,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import type { Meta } from '../../../contract/api.js';
import type { Evento } from '../../../contract/types.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { diaLocal } from '../../common/dates/dates.js';
import { esIdConPrefijo, nuevoId } from '../../common/ids/ids.js';
import { Reloj } from '../../common/clock/clock.js';
import { calcularPaginacion } from '../../common/response/pagination.js';
import { EventosGuardadosServicio } from '../saved-events/saved-events.service.js';
import { LugaresServicio } from '../places/places.service.js';
import type { CambiarEstadoDto } from './dto/change-status.dto.js';
import type { ListarEventosDto } from './dto/list-events.dto.js';
import type { EventoACargar } from './event-to-load.js';
import { EventoEntidad } from './event.entity.js';
import { aContrato } from './events.mapper.js';
import { comienzoDelDia, comienzoDelDiaSiguiente, esDiaValido, finEfectivo } from './rules/agenda.js';

const MENSAJE_DIA = 'El día tiene que ser una fecha real con el formato AAAA-MM-DD, por ejemplo 2026-11-14.';

@Injectable()
export class EventosServicio {
  constructor(
    @InjectRepository(EventoEntidad) private readonly repo: Repository<EventoEntidad>,
    private readonly lugares: LugaresServicio,
    private readonly guardados: EventosGuardadosServicio,
    private readonly reloj: Reloj,
  ) {}

  async listar(filtros: ListarEventosDto): Promise<{ datos: Evento[]; meta: Meta }> {
    const ahora = this.reloj.ahora();
    const { pagina, porPagina, saltar } = calcularPaginacion(filtros);
    const { desde, hasta } = this.rango(filtros, ahora);
    const meta = (total: number): Meta => ({ total, pagina, porPagina });
    if (filtros.lugarId !== undefined && !esIdConPrefijo(filtros.lugarId, 'lug')) {
      return { datos: [], meta: meta(0) };
    }

    // `finalizado` se calcula (R9, D3): programado y con el fin efectivo ya pasado.
    const base: FindOptionsWhere<EventoEntidad> = {};
    if (filtros.lugarId !== undefined) base.lugarId = filtros.lugarId;
    let corteDeFin: FindOperator<Date> | undefined;
    if (filtros.estado === 'finalizado' || filtros.estado === 'programado') {
      base.estado = 'programado';
      corteDeFin = filtros.estado === 'finalizado' ? LessThan(ahora) : MoreThanOrEqual(ahora);
    } else if (filtros.estado) {
      base.estado = filtros.estado;
    }

    // R8: el intervalo se superpone con [desde, hasta): empieza dentro, o empieza antes y termina después.
    const empiezaDentro = hasta ? And(MoreThanOrEqual(desde), LessThan(hasta)) : MoreThanOrEqual(desde);
    const empiezaAntes: FindOptionsWhere<EventoEntidad> = { ...base };
    if (hasta) empiezaAntes.inicio = LessThan(hasta);
    empiezaAntes.finEfectivo = corteDeFin ? And(MoreThan(desde), corteDeFin) : MoreThan(desde);
    const dentro: FindOptionsWhere<EventoEntidad> = { ...base, inicio: empiezaDentro };
    if (corteDeFin) dentro.finEfectivo = corteDeFin;

    const [filas, total] = await this.repo.findAndCount({
      where: [dentro, empiezaAntes],
      order: { inicio: 'ASC', id: 'ASC' },
      skip: saltar,
      take: porPagina,
    });
    return { datos: filas.map((f) => aContrato(f, ahora)), meta: meta(total) };
  }

  async detalle(id: string): Promise<Evento> {
    const evento = await this.buscar(id);
    if (!evento) throw new ErrorApi('EVENTO_NO_ENCONTRADO');
    return aContrato(evento, this.reloj.ahora());
  }

  /** R10: cambiar a un estado igual al actual no hace nada. */
  async cambiarEstado(id: string, { estado }: CambiarEstadoDto): Promise<Evento> {
    const evento = await this.buscar(id);
    if (!evento) throw new ErrorApi('EVENTO_NO_ENCONTRADO');
    if (evento.estado !== estado) {
      const antes = evento.estado;
      await this.repo.update({ id }, { estado });
      evento.estado = estado;
      // Después de guardar el cambio y sin frenar la respuesta (AGENTS §9, especificación §7).
      await this.guardados.avisarCambioDeEstado(evento, antes);
    }
    return aContrato(evento, this.reloj.ahora());
  }

  /** Alta desde la semilla (no hay endpoint de carga). Mantiene el fin efectivo (D3). */
  async cargar(datos: EventoACargar): Promise<string> {
    const id = datos.id ?? nuevoId('evt');
    if (!esIdConPrefijo(id, 'evt')) throw new Error(`Id de evento inválido: ${id}`);
    if ((datos.lugarId === null) === (datos.direccionLibre === null)) {
      throw new Error('Un evento tiene lugarId o direccionLibre, uno solo de los dos (R7).');
    }
    if (datos.lugarId !== null && datos.coordenadas !== null) {
      throw new Error('Las coordenadas de un evento sólo van cuando no tiene lugarId (R7).');
    }
    if (datos.lugarId !== null && !(await this.lugares.existe(datos.lugarId))) {
      throw new Error(`El lugar ${datos.lugarId} no existe`);
    }
    if (datos.fin && datos.fin.getTime() < datos.inicio.getTime()) {
      throw new Error('El evento termina antes de empezar.');
    }
    await this.repo.insert({
      id,
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      lugarId: datos.lugarId,
      direccionLibre: datos.direccionLibre,
      latitud: datos.coordenadas?.latitud ?? null,
      longitud: datos.coordenadas?.longitud ?? null,
      inicio: datos.inicio,
      fin: datos.fin,
      finEfectivo: finEfectivo(datos.inicio, datos.fin),
      imagenClave: datos.imagenClave,
      precio: datos.precio,
      estado: datos.estado,
    });
    return id;
  }

  private rango(filtros: ListarEventosDto, ahora: Date): { desde: Date; hasta: Date | null } {
    for (const dia of [filtros.fecha, filtros.desde, filtros.hasta]) {
      if (dia !== undefined && !esDiaValido(dia)) throw new ErrorApi('VALIDACION_FALLIDA', MENSAJE_DIA);
    }
    if (filtros.fecha !== undefined) {
      if (filtros.desde !== undefined || filtros.hasta !== undefined) {
        throw new ErrorApi('VALIDACION_FALLIDA', 'Usá «fecha» o «desde» y «hasta», pero no las dos cosas.');
      }
      return { desde: comienzoDelDia(filtros.fecha), hasta: comienzoDelDiaSiguiente(filtros.fecha) };
    }
    const desdeDia = filtros.desde ?? diaLocal(ahora);
    if (filtros.hasta !== undefined && filtros.hasta < desdeDia) {
      throw new ErrorApi('VALIDACION_FALLIDA', 'El día «hasta» no puede ser anterior al día «desde».');
    }
    return {
      desde: comienzoDelDia(desdeDia),
      hasta: filtros.hasta === undefined ? null : comienzoDelDiaSiguiente(filtros.hasta),
    };
  }

  /** Por id exacto: en MySQL y MariaDB `evt-ABC` encontraría `evt-abc`. */
  private async buscar(id: string): Promise<EventoEntidad | null> {
    if (!esIdConPrefijo(id, 'evt')) return null;
    const evento = await this.repo.findOneBy({ id });
    return evento?.id === id ? evento : null;
  }
}
