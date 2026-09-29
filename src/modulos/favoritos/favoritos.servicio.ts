import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Meta } from '../../../contrato/api.js';
import type { Favorito } from '../../../contrato/tipos.js';
import { esViolacionDeUnicidad } from '../../comun/db/unicidad.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { esIdConPrefijo, nuevoId } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { calcularPaginacion } from '../../comun/respuesta/paginacion.js';
import type { PaginacionDto } from '../../comun/respuesta/paginacion.dto.js';
import { LugaresServicio } from '../lugares/lugares.servicio.js';
import { FavoritoEntidad } from './favorito.entidad.js';
import { aContrato } from './favoritos.mapeador.js';

@Injectable()
export class FavoritosServicio {
  constructor(
    @InjectRepository(FavoritoEntidad) private readonly repo: Repository<FavoritoEntidad>,
    private readonly lugares: LugaresServicio,
    private readonly reloj: Reloj,
  ) {}

  /** Más nuevo primero; si empatan en el segundo, por id (AGENTS §4.2). */
  async listar(usuarioId: string, pedido: PaginacionDto): Promise<{ datos: Favorito[]; meta: Meta }> {
    const { pagina, porPagina, saltar } = calcularPaginacion(pedido);
    const [filas, total] = await this.repo.findAndCount({
      where: { usuarioId },
      order: { creadoEn: 'DESC', id: 'DESC' },
      skip: saltar,
      take: porPagina,
    });
    return { datos: filas.map(aContrato), meta: { total, pagina, porPagina } };
  }

  /** R11: uno por usuario y lugar. Dos pedidos a la vez: el índice único deja pasar uno solo. */
  async marcar(usuarioId: string, lugarId: string): Promise<{ favorito: Favorito; creado: boolean }> {
    if (!esIdConPrefijo(lugarId, 'lug') || !(await this.lugares.existe(lugarId))) {
      throw new ErrorApi('LUGAR_NO_ENCONTRADO');
    }
    const existente = await this.repo.findOneBy({ usuarioId, lugarId });
    if (existente) return { favorito: aContrato(existente), creado: false };
    try {
      const fila = await this.repo.save(
        this.repo.create({ id: nuevoId('fav'), usuarioId, lugarId, creadoEn: this.reloj.ahora() }),
      );
      return { favorito: aContrato(fila), creado: true };
    } catch (error) {
      if (!esViolacionDeUnicidad(error)) throw error;
      const ganador = await this.repo.findOneByOrFail({ usuarioId, lugarId });
      return { favorito: aContrato(ganador), creado: false };
    }
  }

  /** Idempotente: si no estaba, no pasa nada. */
  async desmarcar(usuarioId: string, lugarId: string): Promise<void> {
    if (!esIdConPrefijo(lugarId, 'lug')) return;
    await this.repo.delete({ usuarioId, lugarId });
  }

  /** Alta desde la semilla, con el id del PRD. */
  async cargar(f: { id: string; usuarioId: string; lugarId: string; creadoEn: Date }): Promise<void> {
    if (!esIdConPrefijo(f.id, 'fav')) throw new Error(`Id de favorito inválido: ${f.id}`);
    await this.repo.insert(f);
  }
}
