import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Coordenadas } from '../../../contrato/tipos.js';
import { puntoEnPoligono } from '../../comun/geo/poligono.js';
import type { Pagina } from '../../comun/respuesta/respuesta.js';
import { saltoYTamano } from '../../comun/respuesta/respuesta.js';
import { Zona } from './zona.entidad.js';

@Injectable()
export class ServicioZonas {
  constructor(
    @InjectRepository(Zona) private readonly zonas: Repository<Zona>,
  ) {}

  async listar(pagina: Pagina): Promise<[Zona[], number]> {
    return this.zonas.findAndCount({
      order: { nombre: 'ASC', id: 'ASC' },
      ...saltoYTamano(pagina),
    });
  }

  /** La zona que contiene el punto, o null si cae fuera de todas (R5). Empate: la de menor id. */
  async zonaDe(punto: Coordenadas): Promise<Zona | null> {
    const todas = await this.zonas.find({ order: { id: 'ASC' } });
    return todas.find((z) => puntoEnPoligono(punto, z.limite)) ?? null;
  }
}
