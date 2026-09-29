import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { saltoYTamano, type Pagina } from '../../comun/respuesta/respuesta.js';
import { TipoDeReporte } from './tipo-de-reporte.entidad.js';

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
}
