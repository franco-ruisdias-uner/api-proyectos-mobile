import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, type FindOptionsWhere, In, Repository } from 'typeorm';
import type { Feriado, Meta } from '../../../contrato/api.js';
import type { Horario } from '../../../contrato/tipos.js';
import { ErrorDeApi } from '../../comun/errores/error-de-api.js';
import { diaEnZona, sumarDias } from '../../comun/fechas/fechas.js';
import { esIdDe } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { paginar } from '../../comun/respuesta/respuesta.js';
import { LineaEntidad } from '../red/linea.entidad.js';
import { ParadaEntidad } from '../red/parada.entidad.js';
import type { ListarFeriadosDto } from './dto/listar-feriados.dto.js';
import type { ListarHorariosDto } from './dto/listar-horarios.dto.js';
import { CANTIDAD_POR_DEFECTO, type ProximosDto } from './dto/proximos.dto.js';
import { FeriadoEntidad } from './feriado.entidad.js';
import { HorarioEntidad } from './horario.entidad.js';
import { feriadoAContrato, horarioAContrato } from './horarios.mapeador.js';
import { proximosPasos } from './reglas/proximos.js';

interface Pagina<T> {
  datos: T[];
  meta: Meta;
}

@Injectable()
export class HorariosServicio {
  constructor(
    @InjectRepository(HorarioEntidad) private readonly horarios: Repository<HorarioEntidad>,
    @InjectRepository(FeriadoEntidad) private readonly feriados: Repository<FeriadoEntidad>,
    @InjectRepository(ParadaEntidad) private readonly paradas: Repository<ParadaEntidad>,
    @InjectRepository(LineaEntidad) private readonly lineas: Repository<LineaEntidad>,
    private readonly reloj: Reloj,
  ) {}

  /** R7: sin `lineaId` ni `paradaId` no se descargan todas las filas de una. */
  async listarHorarios(filtros: ListarHorariosDto): Promise<Pagina<Horario>> {
    if (!filtros.lineaId && !filtros.paradaId) {
      throw new ErrorDeApi(
        'VALIDACION_FALLIDA',
        'Indicá la línea (lineaId) o la parada (paradaId) de los horarios que buscás.',
      );
    }
    // Sólo los filtros que vinieron: TypeORM 1.x falla con un `where` en undefined.
    const where: FindOptionsWhere<HorarioEntidad> = {};
    if (filtros.lineaId) where.lineaId = filtros.lineaId;
    if (filtros.paradaId) where.paradaId = filtros.paradaId;
    if (filtros.sentido) where.sentido = filtros.sentido;
    if (filtros.tipoDeDia) where.tipoDeDia = filtros.tipoDeDia;

    const pagina = paginar(filtros);
    const [filas, total] = await this.horarios.findAndCount({
      where,
      order: { hora: 'ASC', lineaId: 'ASC', paradaId: 'ASC', id: 'ASC' },
      skip: pagina.skip,
      take: pagina.take,
    });
    return {
      datos: filas.map(horarioAContrato),
      meta: { total, pagina: pagina.pagina, porPagina: pagina.porPagina },
    };
  }

  /** R8: ver `reglas/proximos.ts`. */
  async proximos(paradaId: string, filtros: ProximosDto): Promise<Pagina<Horario>> {
    const parada = esIdDe('par', paradaId) ? await this.paradas.findOneBy({ id: paradaId }) : null;
    if (!parada || parada.id !== paradaId) throw new ErrorDeApi('PARADA_NO_ENCONTRADA');

    const where: FindOptionsWhere<HorarioEntidad> = { paradaId };
    if (filtros.lineaId) where.lineaId = filtros.lineaId;
    const filas = await this.horarios.findBy(where);

    const ahora = this.reloj.ahora();
    const hoy = diaEnZona(ahora);
    const deFeriado = await this.feriados.findBy({ fecha: In([hoy, sumarDias(hoy, 1)]) });

    const datos = proximosPasos({
      ahora,
      horarios: filas.map(horarioAContrato),
      feriados: new Set(deFeriado.map((f) => f.fecha)),
      cantidad: filtros.cantidad ?? CANTIDAD_POR_DEFECTO,
    });
    // No hay páginas: son los próximos pasos y nada más.
    return {
      datos,
      meta: { total: datos.length, pagina: 1, porPagina: Math.max(datos.length, 1) },
    };
  }

  async listarFeriados(filtros: ListarFeriadosDto): Promise<Pagina<Feriado>> {
    const anio = filtros.anio ?? Number(diaEnZona(this.reloj.ahora()).slice(0, 4));
    const delAnio = await this.feriados.find({
      where: { fecha: Between(`${anio}-01-01`, `${anio}-12-31`) },
      order: { fecha: 'ASC' },
    });
    const pagina = paginar(filtros);
    return {
      datos: delAnio.slice(pagina.skip, pagina.skip + pagina.take).map(feriadoAContrato),
      meta: { total: delAnio.length, pagina: pagina.pagina, porPagina: pagina.porPagina },
    };
  }
}
