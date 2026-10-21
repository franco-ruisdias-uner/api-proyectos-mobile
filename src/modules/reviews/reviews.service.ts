import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, IsNull, type Repository } from 'typeorm';
import type { Resena as ResenaContrato } from '../../../contract/types.js';
import { esViolacionDeUnicidad } from '../../common/db/db-errors.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { parsearInstante } from '../../common/dates/dates.js';
import { nuevoId } from '../../common/ids/ids.js';
import { Reloj } from '../../common/clock/clock.js';
import { Comercio } from '../businesses/business.entity.js';
import { esIdDeComercio } from '../businesses/rules/businesses.js';
import { UsuariosServicio } from '../users/users.service.js';
import type { CrearResenaDto } from './dto/create-review.dto.js';
import type { EditarResenaDto } from './dto/edit-review.dto.js';
import { ReporteDeResena } from './review-report.entity.js';
import { esIdDeResena, fechaEnElFuturo, promedioDeEstrellas } from './rules/reviews.js';
import { Resena } from './review.entity.js';
import { resenaAContrato } from './reviews.mapper.js';

@Injectable()
export class ResenasServicio {
  constructor(
    @InjectRepository(Resena) private readonly resenas: Repository<Resena>,
    @InjectRepository(Comercio) private readonly comercios: Repository<Comercio>,
    @InjectRepository(ReporteDeResena) private readonly reportes: Repository<ReporteDeResena>,
    private readonly usuarios: UsuariosServicio,
    private readonly dataSource: DataSource,
    private readonly reloj: Reloj,
  ) {}

  /** De la más nueva a la más vieja; el empate se desempata por id (AGENTS §4.2). */
  async listar(
    comercioId: string,
    p: { pagina: number; porPagina: number },
  ): Promise<{ datos: ResenaContrato[]; total: number }> {
    await this.exigirComercio(comercioId);
    const [filas, total] = await this.resenas.findAndCount({
      where: { comercioId },
      order: { creadaEn: 'DESC', id: 'DESC' },
      skip: (p.pagina - 1) * p.porPagina,
      take: p.porPagina,
    });
    return { datos: filas.map(resenaAContrato), total };
  }

  /**
   * Idempotente por `id` (AGENTS §10.5): si ya existe una del mismo usuario devuelve esa
   * (`creada: false`); si es de otro, `ID_EN_USO`. Una por vecino y comercio (R7).
   */
  async crear(
    usuarioId: string,
    comercioId: string,
    dto: CrearResenaDto,
  ): Promise<{ resena: ResenaContrato; creada: boolean }> {
    const ahora = this.reloj.ahora();
    let creadaEn = ahora;
    if (dto.creadaEn !== undefined) {
      const fecha = parsearInstante(dto.creadaEn);
      if (!fecha) throw new ErrorApi('VALIDACION_FALLIDA', 'La fecha de la reseña no es válida.');
      creadaEn = fecha;
    }
    await this.exigirComercio(comercioId);

    if (dto.id) {
      const existente = await this.resenas.findOneBy({ id: dto.id });
      if (existente) return this.paraReenvio(existente, usuarioId);
    }
    if (fechaEnElFuturo(creadaEn, ahora)) throw new ErrorApi('FECHA_EN_EL_FUTURO');
    if (await this.resenas.existsBy({ comercioId, usuarioId })) {
      throw new ErrorApi('RESENA_YA_EXISTE');
    }

    const nueva: Resena = {
      id: dto.id ?? nuevoId('res'),
      comercioId,
      usuarioId,
      estrellas: dto.estrellas,
      comentario: dto.comentario,
      respuesta: null,
      reportada: false,
      creadaEn,
    };
    try {
      await this.dataSource.transaction(async (m) => {
        await m.getRepository(Resena).insert(nueva);
        await this.recalcular(m, comercioId);
      });
    } catch (error) {
      if (!esViolacionDeUnicidad(error)) throw error;
      // Otro pedido ganó la carrera: o era el mismo id (reenvío) o es la reseña propia o un id ajeno.
      const mismoId = await this.resenas.findOneBy({ id: nueva.id });
      if (mismoId) return this.paraReenvio(mismoId, usuarioId);
      throw new ErrorApi('RESENA_YA_EXISTE');
    }
    return { resena: resenaAContrato(nueva), creada: true };
  }

  async editar(usuarioId: string, id: string, cambios: EditarResenaDto): Promise<ResenaContrato> {
    const resena = await this.deAutor(usuarioId, id);
    if (cambios.estrellas !== undefined) resena.estrellas = cambios.estrellas;
    if (cambios.comentario !== undefined) resena.comentario = cambios.comentario;
    await this.dataSource.transaction(async (m) => {
      await m
        .getRepository(Resena)
        .update({ id }, { estrellas: resena.estrellas, comentario: resena.comentario });
      await this.recalcular(m, resena.comercioId);
    });
    return resenaAContrato(resena);
  }

  async borrar(usuarioId: string, id: string): Promise<void> {
    const resena = await this.deAutor(usuarioId, id);
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(ReporteDeResena).delete({ resenaId: id });
      await m.getRepository(Resena).delete({ id });
      await this.recalcular(m, resena.comercioId);
    });
  }

  /** R10: cualquiera con sesión salvo el autor; una vez por usuario (repetirlo no cambia nada). */
  async reportar(usuarioId: string, id: string): Promise<ResenaContrato> {
    const resena = await this.existente(id);
    if (resena.usuarioId === usuarioId) throw new ErrorApi('REPORTE_PROPIO');
    if (!(await this.reportes.existsBy({ resenaId: id, usuarioId }))) {
      try {
        await this.reportes.insert({ resenaId: id, usuarioId, creadoEn: this.reloj.ahora() });
      } catch (error) {
        if (!esViolacionDeUnicidad(error)) throw error;
      }
    }
    await this.resenas.update({ id }, { reportada: true });
    resena.reportada = true;
    return resenaAContrato(resena);
  }

  /** R9: sólo el comercio reseñado y una vez. La actualización condicionada cubre los pedidos simultáneos. */
  async responder(usuarioId: string, id: string, respuesta: string): Promise<ResenaContrato> {
    const resena = await this.existente(id);
    const usuario = await this.usuarios.deLaSesion(usuarioId);
    if (usuario.comercioId !== resena.comercioId) throw new ErrorApi('SIN_PERMISO');
    if (resena.respuesta !== null) throw new ErrorApi('RESENA_YA_RESPONDIDA');
    const { affected } = await this.resenas.update({ id, respuesta: IsNull() }, { respuesta });
    if (!affected) throw new ErrorApi('RESENA_YA_RESPONDIDA');
    resena.respuesta = respuesta;
    return resenaAContrato(resena);
  }

  private paraReenvio(existente: Resena, usuarioId: string) {
    if (existente.usuarioId !== usuarioId) throw new ErrorApi('ID_EN_USO');
    return { resena: resenaAContrato(existente), creada: false };
  }

  private async exigirComercio(comercioId: string): Promise<void> {
    if (!esIdDeComercio(comercioId) || !(await this.comercios.existsBy({ id: comercioId }))) {
      throw new ErrorApi('COMERCIO_NO_ENCONTRADO');
    }
  }

  private async existente(id: string): Promise<Resena> {
    const resena = esIdDeResena(id) ? await this.resenas.findOneBy({ id }) : null;
    if (!resena) throw new ErrorApi('RESENA_NO_ENCONTRADA');
    return resena;
  }

  private async deAutor(usuarioId: string, id: string): Promise<Resena> {
    const resena = await this.existente(id);
    if (resena.usuarioId !== usuarioId) throw new ErrorApi('SIN_PERMISO');
    return resena;
  }

  /** R8: puntaje y cantidad salen de la tabla, en la misma transacción que cambia las reseñas. */
  private async recalcular(m: EntityManager, comercioId: string): Promise<void> {
    const filas = await m.getRepository(Resena).find({
      select: { estrellas: true },
      where: { comercioId },
    });
    await m.getRepository(Comercio).update(
      { id: comercioId },
      {
        puntaje: promedioDeEstrellas(filas.map((f) => f.estrellas)),
        cantidadResenas: filas.length,
      },
    );
  }
}
