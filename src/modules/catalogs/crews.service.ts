import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsWhere, Repository } from 'typeorm';
import { saltoYTamano, type Pagina } from '../../common/response/response.js';
import { Cuadrilla } from './crew.entity.js';

export interface FiltroCuadrillas {
  zonaId?: string;
  activa?: boolean;
}

@Injectable()
export class ServicioCuadrillas {
  constructor(
    @InjectRepository(Cuadrilla)
    private readonly cuadrillas: Repository<Cuadrilla>,
  ) {}

  listar(
    filtro: FiltroCuadrillas,
    pagina: Pagina,
  ): Promise<[Cuadrilla[], number]> {
    // TypeORM 1.x: un where con undefined tira error, se arma sólo con lo que vino.
    const where: FindOptionsWhere<Cuadrilla> = {};
    if (filtro.zonaId !== undefined) where.zonaId = filtro.zonaId;
    if (filtro.activa !== undefined) where.activa = filtro.activa;
    return this.cuadrillas.findAndCount({
      where,
      order: { id: 'ASC' },
      ...saltoYTamano(pagina),
    });
  }
}
