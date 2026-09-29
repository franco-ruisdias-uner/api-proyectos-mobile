import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Meta } from '../../../contrato/api.js';
import type { Visita } from '../../../contrato/tipos.js';
import { VerificadorArchivos } from '../../comun/archivos/verificador-archivos.js';
import { esViolacionDeUnicidad } from '../../comun/db/unicidad.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { leerInstante } from '../../comun/fechas/fechas.js';
import { esIdConPrefijo, nuevoId } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { calcularPaginacion } from '../../comun/respuesta/paginacion.js';
import { LugaresServicio } from '../lugares/lugares.servicio.js';
import type { ActualizarVisitaDto, CrearVisitaDto, ListarVisitasDto } from './dto/visitas.dto.js';
import { estaEnElFuturo, normalizarNota } from './reglas/visitas.js';
import { VisitaEntidad } from './visita.entidad.js';
import { aContrato } from './visitas.mapeador.js';

@Injectable()
export class VisitasServicio {
  constructor(
    @InjectRepository(VisitaEntidad) private readonly repo: Repository<VisitaEntidad>,
    private readonly lugares: LugaresServicio,
    private readonly archivos: VerificadorArchivos,
    private readonly reloj: Reloj,
  ) {}

  /** En orden: la más vieja primero; si empatan, por id (AGENTS §4.2). */
  async listar(usuarioId: string, pedido: ListarVisitasDto): Promise<{ datos: Visita[]; meta: Meta }> {
    const { pagina, porPagina, saltar } = calcularPaginacion(pedido);
    const [filas, total] = await this.repo.findAndCount({
      where: { usuarioId },
      order: { fechaHora: 'ASC', id: 'ASC' },
      skip: saltar,
      take: porPagina,
    });
    return { datos: filas.map(aContrato), meta: { total, pagina, porPagina } };
  }

  /**
   * R12: idempotente por `id`. Si ya existe y es del mismo usuario, se devuelve tal cual (200);
   * si es de otro, `ID_EN_USO`. Dos pedidos a la vez: la clave primaria deja pasar uno solo.
   */
  async crear(usuarioId: string, dto: CrearVisitaDto): Promise<{ visita: Visita; creada: boolean }> {
    if (dto.id) {
      const existente = await this.repo.findOneBy({ id: dto.id });
      if (existente) return this.existente(existente, usuarioId);
    }
    if (!esIdConPrefijo(dto.lugarId, 'lug') || !(await this.lugares.existe(dto.lugarId))) {
      throw new ErrorApi('LUGAR_NO_ENCONTRADO');
    }
    const fechaHora = leerInstante(dto.fechaHora) as Date;
    if (estaEnElFuturo(fechaHora, this.reloj.ahora())) throw new ErrorApi('FECHA_EN_EL_FUTURO');
    const fotoClave = dto.fotoUri ? await this.archivos.claveSubida(dto.fotoUri, 'imagen') : null;
    const fila = this.repo.create({
      id: dto.id ?? nuevoId('vis'),
      usuarioId,
      lugarId: dto.lugarId,
      fechaHora,
      origen: dto.origen,
      fotoClave,
      nota: normalizarNota(dto.nota) ?? null,
      creadoEn: this.reloj.ahora(),
    });
    try {
      await this.repo.insert(fila);
    } catch (error) {
      if (!esViolacionDeUnicidad(error)) throw error;
      return this.existente(await this.repo.findOneByOrFail({ id: fila.id }), usuarioId);
    }
    return { visita: aContrato(fila), creada: true };
  }

  /** Sólo la foto y la nota cambian; la foto puede llegar después que la visita. */
  async actualizar(usuarioId: string, id: string, dto: ActualizarVisitaDto): Promise<Visita> {
    const visita = esIdConPrefijo(id, 'vis') ? await this.repo.findOneBy({ id }) : null;
    if (!visita) throw new ErrorApi('VISITA_NO_ENCONTRADA');
    if (visita.usuarioId !== usuarioId) throw new ErrorApi('SIN_PERMISO');
    const cambios: Partial<Pick<VisitaEntidad, 'fotoClave' | 'nota'>> = {};
    if (dto.fotoUri !== undefined) {
      cambios.fotoClave =
        dto.fotoUri === null ? null : await this.archivos.claveSubida(dto.fotoUri, 'imagen');
    }
    const nota = normalizarNota(dto.nota);
    if (nota !== undefined) cambios.nota = nota;
    if (Object.keys(cambios).length > 0) await this.repo.update({ id }, cambios);
    return aContrato({ ...visita, ...cambios });
  }

  /** Alta desde la semilla, con el id del PRD. */
  async cargar(v: Omit<VisitaEntidad, 'creadoEn'> & { creadoEn?: Date }): Promise<void> {
    if (!esIdConPrefijo(v.id, 'vis')) throw new Error(`Id de visita inválido: ${v.id}`);
    await this.repo.insert({ ...v, creadoEn: v.creadoEn ?? v.fechaHora });
  }

  private existente(fila: VisitaEntidad, usuarioId: string): { visita: Visita; creada: boolean } {
    if (fila.usuarioId !== usuarioId) throw new ErrorApi('ID_EN_USO');
    return { visita: aContrato(fila), creada: false };
  }
}
