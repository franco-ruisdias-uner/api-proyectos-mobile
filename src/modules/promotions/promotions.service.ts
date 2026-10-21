import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsWhere, Repository } from 'typeorm';
import type { Promocion as PromocionContrato } from '../../../contract/types.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { Reloj } from '../../common/clock/clock.js';
import { Comercio } from '../businesses/business.entity.js';
import type { ListarPromocionesDto } from './dto/list-promotions.dto.js';
import { Promocion } from './promotion.entity.js';
import { promocionAContrato } from './promotions.mapper.js';
import {
  clasificarPromocion,
  coincideConEstado,
  esIdDePromocion,
  ordenarPromociones,
} from './rules/promotions.js';

@Injectable()
export class PromocionesServicio {
  constructor(
    @InjectRepository(Promocion) private readonly promociones: Repository<Promocion>,
    @InjectRepository(Comercio) private readonly comercios: Repository<Comercio>,
    private readonly reloj: Reloj,
  ) {}

  /**
   * Las del estado pedido, de comercios activos (R4, R5). La base filtra lo que se puede filtrar
   * igual en los cuatro motores (`activa`, comercio); las fechas y el orden se resuelven en
   * TypeScript con el reloj inyectado, como en el listado de comercios (A16).
   */
  async listar(q: ListarPromocionesDto): Promise<{ datos: PromocionContrato[]; total: number }> {
    const ahora = this.reloj.ahora();
    const whereComercio: FindOptionsWhere<Comercio> = { activo: true };
    if (q.rubroId) whereComercio.rubroId = q.rubroId;
    const activos = new Set(
      (await this.comercios.find({ select: { id: true }, where: whereComercio })).map((c) => c.id),
    );

    const where: FindOptionsWhere<Promocion> = { activa: true };
    if (q.comercioId) where.comercioId = q.comercioId;
    const filas = (await this.promociones.find({ where })).filter(
      (p) => activos.has(p.comercioId) && coincideConEstado(p, q.estado, ahora),
    );

    const ordenadas = ordenarPromociones(filas, q.estado);
    const desde = (q.pagina - 1) * q.porPagina;
    return {
      datos: ordenadas.slice(desde, desde + q.porPagina).map(promocionAContrato),
      total: ordenadas.length,
    };
  }

  /** Detalle: vencida → 410; dada de baja o de un comercio inactivo → 404 (R4). */
  async detalle(id: string): Promise<PromocionContrato> {
    const promo = esIdDePromocion(id) ? await this.promociones.findOneBy({ id }) : null;
    if (!promo) throw new ErrorApi('PROMOCION_NO_ENCONTRADA');
    const comercio = await this.comercios.findOneBy({ id: promo.comercioId });
    const situacion = clasificarPromocion(promo, this.reloj.ahora());
    if (situacion === 'baja' || !comercio?.activo) throw new ErrorApi('PROMOCION_NO_ENCONTRADA');
    if (situacion === 'vencida') throw new ErrorApi('PROMO_VENCIDA');
    return promocionAContrato(promo);
  }
}
