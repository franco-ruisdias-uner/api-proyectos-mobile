import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsWhere, Repository } from 'typeorm';
import type { RespuestaLista, RespuestaUno } from '../../../contrato/api.js';
import type { Deporte, Espacio } from '../../../contrato/tipos.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { esIdDe } from '../../comun/ids/ids.js';
import {
  desplazamiento,
  meta,
  type PaginacionDto,
} from '../../comun/respuesta/paginacion.js';
import {
  respuestaLista,
  respuestaUno,
} from '../../comun/respuesta/respuesta.js';
import { normalizarTexto } from '../../comun/texto/normalizar.js';
import { DeporteEntidad } from './deporte.entidad.js';
import { EspacioEntidad } from './espacio.entidad.js';
import type { FiltrosEspaciosDto } from './dto/filtros-espacios.dto.js';
import { aContrato, deporteAContrato } from './espacios.mapeador.js';

@Injectable()
export class EspaciosServicio {
  constructor(
    @InjectRepository(DeporteEntidad)
    private readonly deportes: Repository<DeporteEntidad>,
    @InjectRepository(EspacioEntidad)
    private readonly espacios: Repository<EspacioEntidad>,
  ) {}

  async listarDeportes(p: PaginacionDto): Promise<RespuestaLista<Deporte>> {
    const [filas, total] = await this.deportes.findAndCount({
      order: { id: 'ASC' },
      ...desplazamiento(p),
    });
    return respuestaLista(filas.map(deporteAContrato), meta(total, p));
  }

  async listarEspacios(
    f: FiltrosEspaciosDto,
  ): Promise<RespuestaLista<Espacio>> {
    // TypeORM 1.x tira error con valores undefined: el where sólo lleva lo que vino.
    const where: FindOptionsWhere<EspacioEntidad> = { activo: true };
    if (f.deporteId !== undefined) where.deporteId = f.deporteId;
    if (f.complejo !== undefined)
      where.complejoBusqueda = normalizarTexto(f.complejo);
    if (f.iluminacion !== undefined) where.iluminacion = f.iluminacion;
    if (f.techado !== undefined) where.techado = f.techado;
    const [filas, total] = await this.espacios.findAndCount({
      where,
      order: { id: 'ASC' },
      ...desplazamiento(f),
    });
    return respuestaLista(filas.map(aContrato), meta(total, f));
  }

  async detalle(id: string): Promise<RespuestaUno<Espacio>> {
    const fila = esIdDe('esp', id)
      ? await this.espacios.findOneBy({ id })
      : null;
    if (!fila) throw new ErrorApi('ESPACIO_NO_ENCONTRADO');
    return respuestaUno(aContrato(fila));
  }
}
