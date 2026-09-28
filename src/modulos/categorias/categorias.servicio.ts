import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Meta } from '../../../contrato/api.js';
import type { Categoria } from '../../../contrato/tipos.js';
import { calcularPaginacion } from '../../comun/respuesta/paginacion.js';
import { CategoriasExistentes } from '../usuarios/categorias-existentes.js';
import { CategoriaEntidad } from './categoria.entidad.js';
import { aContrato } from './categorias.mapeador.js';

@Injectable()
export class CategoriasServicio extends CategoriasExistentes {
  constructor(@InjectRepository(CategoriaEntidad) private readonly repo: Repository<CategoriaEntidad>) {
    super();
  }

  async listar(pedido: { pagina?: number; porPagina?: number }): Promise<{ datos: Categoria[]; meta: Meta }> {
    const { pagina, porPagina, saltar } = calcularPaginacion(pedido);
    const [filas, total] = await this.repo.findAndCount({
      order: { orden: 'ASC', id: 'ASC' },
      skip: saltar,
      take: porPagina,
    });
    return { datos: filas.map(aContrato), meta: { total, pagina, porPagina } };
  }

  /**
   * R18. Se compara el id exacto en TypeScript: MySQL y MariaDB comparan texto sin distinguir
   * mayúsculas, y `cat-MUSEOS` no es una categoría.
   */
  async existenTodas(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const encontradas = await this.repo.find({ where: { id: In(ids) }, select: { id: true } });
    const exactas = new Set(encontradas.map((c) => c.id));
    return ids.every((id) => exactas.has(id));
  }

  async existe(id: string): Promise<boolean> {
    return this.existenTodas([id]);
  }

  /** Alta desde la semilla (no hay endpoint: las categorías las carga la cátedra). */
  async cargar(categoria: Categoria): Promise<void> {
    await this.repo.insert({ ...categoria });
  }
}
