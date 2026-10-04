import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  MoreThanOrEqual,
  Not,
  type FindOptionsWhere,
  type Repository,
} from 'typeorm';
import type { Bloqueo, RespuestaLista } from '../../../contrato/api.js';
import type { Espacio, ReservaFija } from '../../../contrato/tipos.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { diaEnZona, esDiaValido } from '../../comun/fechas/fechas.js';
import { esIdDe, nuevoId } from '../../comun/ids/ids.js';
import { Avisos } from '../../comun/notificaciones/avisos.servicio.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { desplazamiento, meta } from '../../comun/respuesta/paginacion.js';
import { respuestaLista } from '../../comun/respuesta/respuesta.js';
import { EspacioEntidad } from '../espacios/espacio.entidad.js';
import { aContrato as espacioAContrato } from '../espacios/espacios.mapeador.js';
import { BloqueoEntidad } from '../turnos/bloqueo.entidad.js';
import { ReservaFijaEntidad } from '../turnos/reserva-fija.entidad.js';
import { ReservaEntidad } from '../turnos/reserva.entidad.js';
import { bloqueoAContrato, fijaAContrato } from './administracion.mapeador.js';
import type {
  CambiarPrecioDto,
  CrearBloqueoDto,
  CrearFijaDto,
  EditarFijaDto,
  FiltrosBloqueosDto,
  FiltrosFijasDto,
} from './dto/administracion.dto.js';
import { bloqueoCubre, turnoTerminado } from './reglas/bloqueos.js';
import {
  fijaCubre,
  fijasSeSuperponen,
  validarFechasDeFija,
  type DatosDeFija,
} from './reglas/fijas.js';
import { validarHoras } from './reglas/horas.js';

const invalido = (mensaje: string): ErrorApi =>
  new ErrorApi('VALIDACION_FALLIDA', mensaje);

@Injectable()
export class AdministracionServicio {
  constructor(
    private readonly reloj: Reloj,
    private readonly dataSource: DataSource,
    private readonly avisos: Avisos,
    @InjectRepository(EspacioEntidad)
    private readonly espacios: Repository<EspacioEntidad>,
    @InjectRepository(BloqueoEntidad)
    private readonly bloqueos: Repository<BloqueoEntidad>,
    @InjectRepository(ReservaFijaEntidad)
    private readonly fijas: Repository<ReservaFijaEntidad>,
    @InjectRepository(ReservaEntidad)
    private readonly reservas: Repository<ReservaEntidad>,
  ) {}

  // ─── Bloqueos ───────────────────────────────────────────────────────────────

  /** R17 y R18: crea los bloqueos y cancela las reservas confirmadas que cubren, todo junto. */
  async crearBloqueos(dto: CrearBloqueoDto): Promise<Bloqueo[]> {
    if (!esDiaValido(dto.fecha))
      throw invalido('La fecha tiene que ser un día con la forma AAAA-MM-DD.');
    const inicio = dto.inicio ?? null;
    const fin = dto.fin ?? null;
    if ((inicio === null) !== (fin === null))
      throw invalido(
        'Tienen que venir el horario de inicio y el de fin, o ninguno.',
      );
    if (inicio !== null && fin !== null) {
      const problema = validarHoras(inicio, fin);
      if (problema) throw invalido(problema);
    }
    const motivo = dto.motivo?.trim() ?? '';
    if (motivo === '') throw new ErrorApi('MOTIVO_REQUERIDO');
    const ahora = this.reloj.ahora();
    if (dto.fecha < diaEnZona(ahora)) throw new ErrorApi('FECHA_PASADA');

    const espacioIds = [...new Set(dto.espacioIds)];
    const existentes = await this.espacios.findBy({ id: In(espacioIds) });
    if (existentes.length !== espacioIds.length)
      throw new ErrorApi('ESPACIO_NO_ENCONTRADO');

    const creados: BloqueoEntidad[] = espacioIds.map((espacioId) =>
      this.bloqueos.create({
        id: nuevoId('blo'),
        espacioId,
        fecha: dto.fecha,
        inicio,
        fin,
        motivo,
      }),
    );
    const canceladas: ReservaEntidad[] = [];
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(BloqueoEntidad).insert(creados);
      const candidatas = await m.getRepository(ReservaEntidad).findBy({
        espacioId: In(espacioIds),
        fecha: dto.fecha,
        estado: 'confirmada',
      });
      for (const r of candidatas) {
        if (!bloqueoCubre({ inicio, fin }, r.inicio)) continue;
        if (turnoTerminado(r.fecha, r.inicio, ahora)) continue;
        const cambio = await m
          .getRepository(ReservaEntidad)
          .update(
            { id: r.id, estado: 'confirmada' },
            { estado: 'cancelada', ocupacion: null },
          );
        if (cambio.affected === 1) canceladas.push(r);
      }
    });

    // Después de confirmar la transacción: un aviso por cada reserva cancelada.
    const [dia, mes] = [dto.fecha.slice(8, 10), dto.fecha.slice(5, 7)];
    for (const r of canceladas)
      this.avisos.avisar([r.usuarioId], {
        titulo: 'Reserva cancelada',
        cuerpo: `Cancelamos tu reserva del ${dia}/${mes} a las ${r.inicio}. Motivo: ${motivo}.`,
        datos: { reservaId: r.id },
      });
    return creados.map(bloqueoAContrato);
  }

  async listarBloqueos(
    f: FiltrosBloqueosDto,
  ): Promise<RespuestaLista<Bloqueo>> {
    const desde = f.desde ?? diaEnZona(this.reloj.ahora());
    if (!esDiaValido(desde))
      throw invalido('La fecha tiene que ser un día con la forma AAAA-MM-DD.');
    const where: FindOptionsWhere<BloqueoEntidad> = {
      fecha: MoreThanOrEqual(desde),
    };
    if (f.espacioId !== undefined) where.espacioId = f.espacioId;
    const [filas, total] = await this.bloqueos.findAndCount({
      where,
      order: { fecha: 'ASC', inicio: 'ASC', id: 'ASC' },
      ...desplazamiento(f),
    });
    return respuestaLista(filas.map(bloqueoAContrato), meta(total, f));
  }

  /** Las reservas que canceló siguen canceladas. */
  async borrarBloqueo(id: string): Promise<void> {
    const borrado = esIdDe('blo', id)
      ? await this.bloqueos.delete({ id })
      : { affected: 0 };
    if (borrado.affected !== 1) throw new ErrorApi('BLOQUEO_NO_ENCONTRADO');
  }

  // ─── Reservas fijas ─────────────────────────────────────────────────────────

  async listarFijas(f: FiltrosFijasDto): Promise<RespuestaLista<ReservaFija>> {
    const where: FindOptionsWhere<ReservaFijaEntidad> = {};
    if (f.espacioId !== undefined) where.espacioId = f.espacioId;
    if (f.activa !== undefined) where.activa = f.activa;
    const [filas, total] = await this.fijas.findAndCount({
      where,
      order: { id: 'ASC' },
      ...desplazamiento(f),
    });
    return respuestaLista(filas.map(fijaAContrato), meta(total, f));
  }

  async crearFija(dto: CrearFijaDto): Promise<ReservaFija> {
    const datos = { ...dto, hasta: dto.hasta ?? null };
    this.validarFija(datos);
    if (!(await this.espacios.existsBy({ id: dto.espacioId })))
      throw new ErrorApi('ESPACIO_NO_ENCONTRADO');
    const fija = this.fijas.create({
      id: nuevoId('fij'),
      ...datos,
      activa: true,
    });
    await this.comprobarChoques(fija, null);
    await this.fijas.insert(fija);
    return fijaAContrato(fija);
  }

  async editarFija(id: string, dto: EditarFijaDto): Promise<ReservaFija> {
    const actual = esIdDe('fij', id)
      ? await this.fijas.findOneBy({ id })
      : null;
    if (!actual) throw new ErrorApi('FIJA_NO_ENCONTRADA');
    const nueva = { ...actual };
    for (const campo of [
      'titular',
      'dia',
      'inicio',
      'fin',
      'desde',
      'hasta',
      'activa',
    ] as const)
      if (dto[campo] !== undefined)
        (nueva as Record<string, unknown>)[campo] = dto[campo];
    this.validarFija(nueva);
    const cambioElHorario =
      nueva.dia !== actual.dia ||
      nueva.inicio !== actual.inicio ||
      nueva.fin !== actual.fin ||
      nueva.desde !== actual.desde ||
      nueva.hasta !== actual.hasta ||
      nueva.activa !== actual.activa;
    if (cambioElHorario && nueva.activa) await this.comprobarChoques(nueva, id);
    await this.fijas.save(nueva);
    return fijaAContrato(nueva);
  }

  async darDeBajaFija(id: string): Promise<void> {
    const existe = esIdDe('fij', id)
      ? await this.fijas.existsBy({ id })
      : false;
    if (!existe) throw new ErrorApi('FIJA_NO_ENCONTRADA');
    await this.fijas.update({ id }, { activa: false });
  }

  private validarFija(f: DatosDeFija): void {
    const horas = validarHoras(f.inicio, f.fin);
    if (horas) throw invalido(horas);
    const fechas = validarFechasDeFija(f.desde, f.hasta);
    if (fechas) throw invalido(fechas);
  }

  /** R19 y D4: no pisa otra fija activa (409) ni cubre reservas confirmadas futuras (409). */
  private async comprobarChoques(
    fija: ReservaFijaEntidad,
    ignorarId: string | null,
  ): Promise<void> {
    const where: FindOptionsWhere<ReservaFijaEntidad> = {
      espacioId: fija.espacioId,
      activa: true,
    };
    if (ignorarId !== null) where.id = Not(ignorarId);
    const otras = await this.fijas.findBy(where);
    if (otras.some((o) => fijasSeSuperponen(o, fija)))
      throw new ErrorApi('FIJA_SUPERPUESTA');

    const ahora = this.reloj.ahora();
    const confirmadas = await this.reservas.findBy({
      espacioId: fija.espacioId,
      estado: 'confirmada',
      fecha: MoreThanOrEqual(fija.desde),
    });
    const choca = confirmadas.some(
      (r) =>
        fijaCubre(fija, r.fecha, r.inicio) &&
        !turnoTerminado(r.fecha, r.inicio, ahora),
    );
    if (choca) throw new ErrorApi('CONFLICTO_CON_RESERVAS');
  }

  // ─── Precio ─────────────────────────────────────────────────────────────────

  /** R20 y D5: cambia el precio de ahora en más; las reservas no guardan precio. */
  async cambiarPrecio(id: string, dto: CambiarPrecioDto): Promise<Espacio> {
    const espacio = esIdDe('esp', id)
      ? await this.espacios.findOneBy({ id })
      : null;
    if (!espacio) throw new ErrorApi('ESPACIO_NO_ENCONTRADO');
    espacio.precioPorHora = dto.precioPorHora;
    await this.espacios.update({ id }, { precioPorHora: dto.precioPorHora });
    return espacioAContrato(espacio);
  }
}
