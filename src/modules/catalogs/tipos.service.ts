import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { saltoYTamano, type Pagina } from '../../common/response/response.js';
import { TipoDeReporte } from './report-type.entity.js';

@Injectable()
export class ServicioTipos {
  constructor(
    @InjectRepository(TipoDeReporte)
    private readonly tipos: Repository<TipoDeReporte>,
  ) {}

  listar(pagina: Pagina): Promise<[TipoDeReporte[], number]> {
    return this.tipos.findAndCount({
      order: { nombre: 'ASC', id: 'ASC' },
      ...saltoYTamano(pagina),
    });
  }

  async existe(id: string): Promise<boolean> {
    return this.tipos.existsBy({ id });
  }
}
