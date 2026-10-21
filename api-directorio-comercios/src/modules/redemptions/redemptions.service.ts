import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, type Repository } from 'typeorm';
import type { UsoDePromocion as UsoContrato } from '../../../contract/types.js';
import { esViolacionDeUnicidad } from '../../common/db/db-errors.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { nuevoId } from '../../common/ids/ids.js';
import { Reloj } from '../../common/clock/clock.js';
import { Comercio } from '../businesses/business.entity.js';
import { Promocion } from '../promotions/promotion.entity.js';
import { esIdDePromocion } from '../promotions/rules/promotions.js';
import { UsuariosServicio } from '../users/users.service.js';
import { generarCodigoDeUso, motivoDeNoUso, normalizarCodigo } from './rules/redemptions.js';
import { UsoDePromocion } from './promotion-redemption.entity.js';
import { usoAContrato } from './redemptions.mapper.js';

const INTENTOS_DE_CODIGO = 5;

/** `PROMO_VENCIDA` da 410 al pedir el detalle, pero 422 al intentar usar o validar (§6). */
const errorDeVigencia = (motivo: 'PROMO_VENCIDA' | 'PROMO_NO_EMPEZO') =>
  new ErrorApi(motivo, undefined, 422);

@Injectable()
export class UsosServicio {
  constructor(
    @InjectRepository(UsoDePromocion) private readonly usos: Repository<UsoDePromocion>,
    @InjectRepository(Promocion) private readonly promociones: Repository<Promocion>,
    @InjectRepository(Comercio) private readonly comercios: Repository<Comercio>,
    private readonly usuarios: UsuariosServicio,
    private readonly dataSource: DataSource,
    private readonly reloj: Reloj,
  ) {}

  /**
   * R11. Una promo dada de baja o de un comercio inactivo no existe para el público (404, R4).
   * Uno por vecino y promo: si ya tenía un código sin validar se devuelve ese (`creado: false`).
   */
  async generar(
    usuarioId: string,
    promocionId: string,
  ): Promise<{ uso: UsoContrato; creado: boolean }> {
    const promo = esIdDePromocion(promocionId)
      ? await this.promociones.findOneBy({ id: promocionId })
      : null;
    if (
      !promo?.activa ||
      !(await this.comercios.existsBy({ id: promo.comercioId, activo: true }))
    ) {
      throw new ErrorApi('PROMOCION_NO_ENCONTRADA');
    }
    if (!promo.soloApp) throw new ErrorApi('PROMO_SIN_CODIGO');
    const motivo = motivoDeNoUso(promo, this.reloj.ahora());
    if (motivo) throw errorDeVigencia(motivo);

    const existente = await this.usos.findOneBy({ promocionId, usuarioId });
    if (existente) return this.paraReenvio(existente);

    const ahora = this.reloj.ahora();
    for (let intento = 0; intento < INTENTOS_DE_CODIGO; intento++) {
      const nuevo: UsoDePromocion = {
        id: nuevoId('uso'),
        promocionId,
        usuarioId,
        codigo: generarCodigoDeUso(),
        generadoEn: ahora,
        validadoEn: null,
      };
      try {
        await this.usos.insert(nuevo);
        return { uso: usoAContrato(nuevo), creado: true };
      } catch (error) {
        if (!esViolacionDeUnicidad(error)) throw error;
        // Otro pedido del mismo vecino ganó la carrera, o el código salió repetido: reintenta.
        const ganador = await this.usos.findOneBy({ promocionId, usuarioId });
        if (ganador) return this.paraReenvio(ganador);
      }
    }
    throw new Error('No se pudo generar un código de uso único.');
  }

  /** Los del vecino, del más nuevo al más viejo; el empate se desempata por id (AGENTS §4.2). */
  async listarDe(
    usuarioId: string,
    p: { pagina: number; porPagina: number },
  ): Promise<{ datos: UsoContrato[]; total: number }> {
    const [filas, total] = await this.usos.findAndCount({
      where: { usuarioId },
      order: { generadoEn: 'DESC', id: 'DESC' },
      skip: (p.pagina - 1) * p.porPagina,
      take: p.porPagina,
    });
    return { datos: filas.map(usoAContrato), total };
  }

  /**
   * R12 y R13. La actualización condicionada a `validadoEn` nulo decide entre dos escaneos
   * simultáneos; `usos` de la promo se recalcula desde la tabla en la misma transacción.
   */
  async validar(usuarioId: string, codigoCrudo: string): Promise<UsoContrato> {
    const usuario = await this.usuarios.deLaSesion(usuarioId);
    if (!usuario.comercioId) throw new ErrorApi('SIN_PERMISO');

    const uso = await this.usos.findOneBy({ codigo: normalizarCodigo(codigoCrudo) });
    if (!uso) throw new ErrorApi('CODIGO_INVALIDO');
    const promo = await this.promociones.findOneByOrFail({ id: uso.promocionId });
    if (promo.comercioId !== usuario.comercioId) throw new ErrorApi('PROMO_DE_OTRO_COMERCIO');
    if (uso.validadoEn !== null) throw new ErrorApi('CODIGO_YA_VALIDADO');
    const motivo = motivoDeNoUso(promo, this.reloj.ahora());
    if (motivo) throw errorDeVigencia(motivo);

    const validadoEn = this.reloj.ahora();
    await this.dataSource.transaction(async (m) => {
      const { affected } = await m
        .getRepository(UsoDePromocion)
        .update({ id: uso.id, validadoEn: IsNull() }, { validadoEn });
      if (!affected) throw new ErrorApi('CODIGO_YA_VALIDADO');
      const validados = await m
        .getRepository(UsoDePromocion)
        .count({ where: { promocionId: promo.id, validadoEn: Not(IsNull()) } });
      await m.getRepository(Promocion).update({ id: promo.id }, { usos: validados });
    });
    return usoAContrato({ ...uso, validadoEn });
  }

  private paraReenvio(existente: UsoDePromocion): { uso: UsoContrato; creado: boolean } {
    if (existente.validadoEn !== null) throw new ErrorApi('PROMO_YA_USADA');
    return { uso: usoAContrato(existente), creado: false };
  }
}
