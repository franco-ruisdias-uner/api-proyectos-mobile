import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import type { RespuestaLista } from '../../../contrato/api.js';
import type { Turno } from '../../../contrato/tipos.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { diaEnZona, esDiaValido } from '../../comun/fechas/fechas.js';
import { esIdDe } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { meta, type PaginacionDto } from '../../comun/respuesta/paginacion.js';
import { respuestaLista } from '../../comun/respuesta/respuesta.js';
import { EspacioEntidad } from '../espacios/espacio.entidad.js';
import { BloqueoEntidad } from './bloqueo.entidad.js';
import { ReservaFijaEntidad } from './reserva-fija.entidad.js';
import { ReservaEntidad } from './reserva.entidad.js';
import { armarGrilla } from './reglas/grilla.js';
import { fechaEnRango } from './reglas/rango-de-fechas.js';

@Injectable()
export class TurnosServicio {
  constructor(
    private readonly reloj: Reloj,
    @InjectRepository(EspacioEntidad)
    private readonly espacios: Repository<EspacioEntidad>,
    @InjectRepository(ReservaEntidad)
    private readonly reservas: Repository<ReservaEntidad>,
    @InjectRepository(ReservaFijaEntidad)
    private readonly fijas: Repository<ReservaFijaEntidad>,
    @InjectRepository(BloqueoEntidad)
    private readonly bloqueos: Repository<BloqueoEntidad>,
  ) {}

  async grilla(
    espacioId: string,
    p: PaginacionDto & { fecha?: string },
  ): Promise<RespuestaLista<Turno>> {
    const hoy = diaEnZona(this.reloj.ahora());
    const fecha = p.fecha ?? hoy;
    if (!esDiaValido(fecha))
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'La fecha tiene que ser un día con la forma AAAA-MM-DD.',
      );
    const espacio = esIdDe('esp', espacioId)
      ? await this.espacios.findOneBy({ id: espacioId, activo: true })
      : null;
    if (!espacio) throw new ErrorApi('ESPACIO_NO_ENCONTRADO');
    if (!fechaEnRango(fecha, hoy)) throw new ErrorApi('FECHA_FUERA_DE_RANGO');

    const turnos = await this.turnosDelDia(espacio, fecha);
    const desde = (p.pagina - 1) * p.porPagina;
    return respuestaLista(
      turnos.slice(desde, desde + p.porPagina),
      meta(turnos.length, p),
    );
  }

  /** Los 16 turnos de un espacio en un día: el cruce de reservas, fijas y bloqueos (R2). */
  async turnosDelDia(
    espacio: Pick<EspacioEntidad, 'id' | 'precioPorHora'>,
    fecha: string,
  ): Promise<Turno[]> {
    const espacioId = espacio.id;
    const [reservas, fijas, bloqueos] = await Promise.all([
      this.reservas.find({
        where: {
          espacioId,
          fecha,
          estado: In(['confirmada', 'cumplida', 'ausente']),
        },
        order: { id: 'ASC' },
      }),
      this.fijas.find({
        where: { espacioId, activa: true },
        order: { id: 'ASC' },
      }),
      this.bloqueos.find({ where: { espacioId, fecha }, order: { id: 'ASC' } }),
    ]);
    return armarGrilla(espacio, fecha, reservas, fijas, bloqueos);
  }
}
