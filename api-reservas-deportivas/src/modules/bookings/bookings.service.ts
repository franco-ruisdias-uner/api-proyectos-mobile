import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  Not,
  type FindOptionsWhere,
  type Repository,
} from 'typeorm';
import type { RespuestaLista } from '../../../contract/api.js';
import type { Reserva } from '../../../contract/types.js';
import type { UsuarioSesion } from '../../common/auth/decorators.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { esViolacionDeUnicidad } from '../../common/errors/uniqueness.js';
import { diaEnZona, esDiaValido } from '../../common/dates/dates.js';
import { esIdDe, nuevoId, textoAleatorio } from '../../common/ids/ids.js';
import { Avisos } from '../../common/notifications/notices.service.js';
import { Reloj } from '../../common/clock/clock.js';
import { meta } from '../../common/response/pagination.js';
import { respuestaLista } from '../../common/response/response.js';
import { EspacioEntidad } from '../venues/venue.entity.js';
import { leerIdDeTurno } from '../slots/rules/slot-id.js';
import { fechaEnRango } from '../slots/rules/date-range.js';
import { ReservaEntidad } from '../slots/reserva.entity.js';
import { TurnosServicio } from '../slots/slots.service.js';
import { FavoritoEntidad } from '../users/favorite.entity.js';
import { UsuarioEntidad } from '../users/user.entity.js';
import type {
  CrearReservaDto,
  FiltrosReservasDto,
  MisReservasDto,
} from './dto/bookings.dto.js';
import {
  codigoQrDe,
  corteDeProximas,
  decidirCancelacion,
  inicioDelTurno,
} from './rules/bookings.js';
import { aContrato } from './bookings.mapper.js';

const MAXIMO_ACTIVAS = 3;
const ALFABETO_QR = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INTENTOS_DE_CODIGO = 5;

@Injectable()
export class ReservasServicio {
  constructor(
    private readonly reloj: Reloj,
    private readonly dataSource: DataSource,
    private readonly turnos: TurnosServicio,
    private readonly avisos: Avisos,
    @InjectRepository(ReservaEntidad)
    private readonly reservas: Repository<ReservaEntidad>,
    @InjectRepository(EspacioEntidad)
    private readonly espacios: Repository<EspacioEntidad>,
    @InjectRepository(FavoritoEntidad)
    private readonly favoritos: Repository<FavoritoEntidad>,
  ) {}

  /** R7, R8, R9 y R11. `creada` es false si el jugador ya tenía ese turno (reintento). */
  async crear(
    jugadorId: string,
    dto: CrearReservaDto,
  ): Promise<{ reserva: Reserva; creada: boolean }> {
    const ahora = this.reloj.ahora();
    const partes = leerIdDeTurno(dto.turnoId);
    const espacio = partes
      ? await this.espacios.findOneBy({ id: partes.espacioId, activo: true })
      : null;
    if (!partes || !espacio) throw new ErrorApi('TURNO_NO_ENCONTRADO');
    const { fecha, inicio } = partes;
    const ocupacion = `${espacio.id}|${fecha}|${inicio}`;

    // R11: si ya lo tiene, es un reintento por mala señal.
    const propia = await this.reservas.findOneBy({
      ocupacion,
      usuarioId: jugadorId,
    });
    if (propia) return { reserva: aContrato(propia), creada: false };

    if (!fechaEnRango(fecha, diaEnZona(ahora)))
      throw new ErrorApi('FECHA_FUERA_DE_RANGO');
    if (inicioDelTurno(fecha, inicio).getTime() <= ahora.getTime())
      throw new ErrorApi('TURNO_PASADO');

    const grilla = await this.turnos.turnosDelDia(espacio, fecha);
    const turno = grilla.find((t) => t.inicio === inicio);
    if (!turno) throw new ErrorApi('TURNO_NO_ENCONTRADO');
    if (turno.estado === 'mantenimiento' || turno.estado === 'fijo')
      throw new ErrorApi('TURNO_NO_DISPONIBLE');
    if (turno.estado === 'reservado') throw new ErrorApi('TURNO_OCUPADO');

    if (dto.cantidadPersonas > espacio.capacidad)
      throw new ErrorApi('CAPACIDAD_EXCEDIDA');
    const activas = await this.reservas.count({
      where: this.filtroProximas(jugadorId, ahora),
    });
    if (activas >= MAXIMO_ACTIVAS) throw new ErrorApi('LIMITE_DE_RESERVAS');

    for (let intento = 0; intento < INTENTOS_DE_CODIGO; intento++) {
      const nueva = this.reservas.create({
        id: nuevoId('res'),
        turnoId: dto.turnoId,
        espacioId: espacio.id,
        usuarioId: jugadorId,
        fecha,
        inicio,
        cantidadPersonas: dto.cantidadPersonas,
        codigoQr: codigoQrDe(fecha, inicio, textoAleatorio(6, ALFABETO_QR)),
        estado: 'confirmada',
        ingresoEn: null,
        creadaEn: ahora,
        ocupacion,
      });
      try {
        await this.reservas.insert(nueva);
        return { reserva: aContrato(nueva), creada: true };
      } catch (error) {
        if (!esViolacionDeUnicidad(error)) throw error;
        // Perdimos la carrera por el turno, o (rarísimo) se repitió el código QR.
        const ganadora = await this.reservas.findOneBy({ ocupacion });
        if (!ganadora) continue;
        if (ganadora.usuarioId === jugadorId)
          return { reserva: aContrato(ganadora), creada: false };
        throw new ErrorApi('TURNO_OCUPADO');
      }
    }
    throw new Error('No se pudo generar un código QR único.');
  }

  async misReservas(
    jugadorId: string,
    q: MisReservasDto,
  ): Promise<RespuestaLista<Reserva>> {
    const ahora = this.reloj.ahora();
    const proximas = q.cuando === 'proximas';
    const [filas, total] = await this.reservas.findAndCount({
      where: proximas
        ? this.filtroProximas(jugadorId, ahora)
        : this.filtroPasadas(jugadorId, ahora),
      order: proximas
        ? { fecha: 'ASC', inicio: 'ASC', id: 'ASC' }
        : { fecha: 'DESC', inicio: 'DESC', id: 'DESC' },
      skip: (q.pagina - 1) * q.porPagina,
      take: q.porPagina,
    });
    return respuestaLista(filas.map(aContrato), meta(total, q));
  }

  /** Para el personal: quién tiene cada turno. Por fecha e `inicio` ascendente. */
  async listar(q: FiltrosReservasDto): Promise<RespuestaLista<Reserva>> {
    if (q.fecha !== undefined && !esDiaValido(q.fecha))
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'La fecha tiene que ser un día con la forma AAAA-MM-DD.',
      );
    if (q.espacioId !== undefined && !esIdDe('esp', q.espacioId))
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'El espacio tiene que ser un id de espacio.',
      );
    // Sólo los filtros que vinieron: TypeORM 1.x falla con valores undefined.
    const donde: FindOptionsWhere<ReservaEntidad> = {};
    if (q.fecha !== undefined) donde.fecha = q.fecha;
    if (q.espacioId !== undefined) donde.espacioId = q.espacioId;
    if (q.estado !== undefined) donde.estado = q.estado;
    const [filas, total] = await this.reservas.findAndCount({
      where: donde,
      order: { fecha: 'ASC', inicio: 'ASC', id: 'ASC' },
      skip: (q.pagina - 1) * q.porPagina,
      take: q.porPagina,
    });
    return respuestaLista(filas.map(aContrato), meta(total, q));
  }

  async ver(id: string, sesion: UsuarioSesion): Promise<Reserva> {
    const reserva = await this.buscar(id);
    this.exigirDuenoOPersonal(reserva, sesion);
    return aContrato(reserva);
  }

  /** R12. Cancelar una ya cancelada no cambia nada. */
  async cancelar(id: string, sesion: UsuarioSesion): Promise<Reserva> {
    const reserva = await this.buscar(id);
    this.exigirDuenoOPersonal(reserva, sesion);

    const decision = decidirCancelacion({
      estado: reserva.estado,
      fecha: reserva.fecha,
      inicio: reserva.inicio,
      ahora: this.reloj.ahora(),
      esDueno: reserva.usuarioId === sesion.id,
      esPersonal: sesion.rol !== 'jugador',
    });
    if ('error' in decision) throw new ErrorApi(decision.error);
    if (decision.accion === 'sin-cambios') return aContrato(reserva);

    // El cambio de estado es condicional: si dos pedidos llegan juntos, sólo uno lo
    // aplica (y sólo ese suma la cancelación tardía).
    const liberada = await this.dataSource.transaction(async (m) => {
      const cambio = await m
        .getRepository(ReservaEntidad)
        .update(
          { id: reserva.id, estado: 'confirmada' },
          { estado: 'cancelada', ocupacion: null },
        );
      if (cambio.affected === 1 && decision.tardia)
        await m
          .getRepository(UsuarioEntidad)
          .increment({ id: reserva.usuarioId }, 'cancelacionesTardias', 1);
      return cambio.affected === 1;
    });
    // R21: sólo el pedido que cambió el estado avisa (después de confirmar).
    if (liberada) await this.avisarTurnoLiberado(reserva, sesion.id);
    return aContrato(await this.buscar(id));
  }

  /** R21: push a quienes tienen el espacio de favorito, salvo a quien canceló. */
  private async avisarTurnoLiberado(
    reserva: ReservaEntidad,
    quienCancelo: string,
  ): Promise<void> {
    const [filas, espacio] = await Promise.all([
      this.favoritos.findBy({ espacioId: reserva.espacioId }),
      this.espacios.findOneBy({ id: reserva.espacioId }),
    ]);
    const destinatarios = filas
      .map((f) => f.usuarioId)
      .filter((id) => id !== quienCancelo);
    if (!espacio || destinatarios.length === 0) return;
    const [dia, mes] = [reserva.fecha.slice(8, 10), reserva.fecha.slice(5, 7)];
    this.avisos.avisar(destinatarios, {
      titulo: 'Se liberó un turno',
      cuerpo: `${espacio.nombre} tiene libre el turno del ${dia}/${mes} a las ${reserva.inicio}.`,
      datos: { espacioId: reserva.espacioId, turnoId: reserva.turnoId },
    });
  }

  private async buscar(id: string): Promise<ReservaEntidad> {
    const reserva = esIdDe('res', id)
      ? await this.reservas.findOneBy({ id })
      : null;
    if (!reserva) throw new ErrorApi('RESERVA_NO_ENCONTRADA');
    return reserva;
  }

  private exigirDuenoOPersonal(
    reserva: ReservaEntidad,
    sesion: UsuarioSesion,
  ): void {
    if (reserva.usuarioId !== sesion.id && sesion.rol === 'jugador')
      throw new ErrorApi('SIN_PERMISO');
  }

  /** R9 y R13: `confirmada` cuyo turno no terminó. */
  private filtroProximas(
    usuarioId: string,
    ahora: Date,
  ): FindOptionsWhere<ReservaEntidad>[] {
    const { dia, hora } = corteDeProximas(ahora);
    const confirmada = { usuarioId, estado: 'confirmada' } as const;
    return [
      { ...confirmada, fecha: MoreThan(dia) },
      { ...confirmada, fecha: dia, inicio: MoreThan(hora) },
    ];
  }

  /** R13: todas las que no son próximas. */
  private filtroPasadas(
    usuarioId: string,
    ahora: Date,
  ): FindOptionsWhere<ReservaEntidad>[] {
    const { dia, hora } = corteDeProximas(ahora);
    const confirmada = { usuarioId, estado: 'confirmada' } as const;
    return [
      { usuarioId, estado: Not('confirmada') },
      { ...confirmada, fecha: LessThan(dia) },
      { ...confirmada, fecha: dia, inicio: LessThanOrEqual(hora) },
    ];
  }
}
