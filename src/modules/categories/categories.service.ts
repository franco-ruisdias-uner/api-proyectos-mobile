import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Meta } from '../../../contract/api.js';
import type { Categoria } from '../../../contract/types.js';
import { esIdConPrefijo } from '../../common/ids/ids.js';
import { calcularPaginacion } from '../../common/response/pagination.js';
import { CategoriasExistentes } from '../users/existing-categories.js';
import { CategoriaEntidad } from './category.entity.js';
import { aContrato } from './categories.mapper.js';

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
    if (!esIdConPrefijo(categoria.id, 'cat')) throw new Error(`Id de categoría inválido: ${categoria.id}`);
    await this.repo.insert({ ...categoria });
  }
}
