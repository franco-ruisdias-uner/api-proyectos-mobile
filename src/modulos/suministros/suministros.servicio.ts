import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOptionsWhere, Like, Repository } from 'typeorm';
import type { Medidor, Suministro } from '../../../contrato/tipos.js';
import type { SesionActual } from '../../comun/auth/sesion-actual.js';
import { ArchivosServicio } from '../../comun/archivos/archivos.servicio.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { paginar } from '../../comun/respuesta/paginacion.js';
import type { Meta } from '../../comun/respuesta/respuesta.js';
import { normalizarParaBusqueda } from '../../comun/texto/normalizar.js';
import { AccesoSuministros } from './acceso-suministros.js';
import type { ListarSuministrosDto } from './dto/suministros.dto.js';
import { MedidorEntidad } from './medidor.entidad.js';
import { SuministroEntidad } from './suministro.entidad.js';
import { aContrato, medidorAContrato } from './suministros.mapeador.js';

@Injectable()
export class SuministrosServicio {
  constructor(
    @InjectRepository(SuministroEntidad)
    private readonly suministros: Repository<SuministroEntidad>,
    @InjectRepository(MedidorEntidad)
    private readonly medidores: Repository<MedidorEntidad>,
    private readonly acceso: AccesoSuministros,
    private readonly archivos: ArchivosServicio,
  ) {}

  async listar(
    filtros: ListarSuministrosDto,
  ): Promise<{ datos: Suministro[]; meta: Meta }> {
    const base: FindOptionsWhere<SuministroEntidad> = {};
    if (filtros.numero !== undefined) base.numero = filtros.numero;
    if (filtros.categoria !== undefined) base.categoria = filtros.categoria;
    if (filtros.activo !== undefined) base.activo = filtros.activo;
    const orden = { numero: 'ASC', id: 'ASC' } as const;

    const termino =
      filtros.buscar === undefined
        ? ''
        : normalizarParaBusqueda(filtros.buscar);
    if (termino === '' && filtros.numero === undefined) {
      const { pagina, porPagina } = filtros;
      const [filas, total] = await this.suministros.findAndCount({
        where: base,
        order: orden,
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      });
      return {
        datos: filas.map(aContrato),
        meta: { total, pagina, porPagina },
      };
    }

    // `%` y `_` del término son comodines de LIKE: la base filtra de más y acá se deja sólo
    // lo que contiene el texto tal cual (igual que en /usuarios).
    const candidatos = await this.suministros.find({
      where:
        termino === ''
          ? base
          : [
              { ...base, titularBusqueda: Like(`%${termino}%`) },
              { ...base, direccionBusqueda: Like(`%${termino}%`) },
            ],
      order: orden,
    });
    // MySQL y MariaDB comparan texto sin distinguir mayúsculas: el número se confirma acá.
    const encontrados = candidatos.filter(
      (s) =>
        (filtros.numero === undefined || s.numero === filtros.numero) &&
        (termino === '' ||
          s.titularBusqueda.includes(termino) ||
          s.direccionBusqueda.includes(termino)),
    );
    const pagina = paginar(encontrados, filtros);
    return { datos: pagina.datos.map(aContrato), meta: pagina.meta };
  }

  /** R3: el lector sólo ve lo que está en una de sus rutas; administración, todo. */
  private async exigirAcceso(
    sesion: SesionActual,
    suministroId: string | null,
  ): Promise<void> {
    if (sesion.rol === 'administracion') return;
    if (
      suministroId === null ||
      !(await this.acceso.puedeVer(sesion.usuarioId, suministroId))
    ) {
      throw new ErrorApi('SIN_PERMISO');
    }
  }

  async obtener(id: string, sesion: SesionActual): Promise<Suministro> {
    const suministro = await this.suministros.findOneBy({ id });
    // Los ids distinguen mayúsculas; MySQL y MariaDB no al comparar: se confirma acá.
    if (suministro?.id !== id) throw new ErrorApi('SUMINISTRO_NO_ENCONTRADO');
    await this.exigirAcceso(sesion, suministro.id);
    return aContrato(suministro);
  }

  private async medidorVisible(
    medidor: MedidorEntidad | null,
    sesion: SesionActual,
  ): Promise<Medidor> {
    if (!medidor) throw new ErrorApi('MEDIDOR_NO_ENCONTRADO');
    const dueno = await this.suministros.findOneBy({ medidorId: medidor.id });
    await this.exigirAcceso(sesion, dueno?.id ?? null);
    return medidorAContrato(medidor, (clave) => this.archivos.url(clave));
  }

  async obtenerMedidor(id: string, sesion: SesionActual): Promise<Medidor> {
    const medidor = await this.medidores.findOneBy({ id });
    // MySQL y MariaDB comparan sin distinguir mayúsculas: se confirma acá.
    return this.medidorVisible(medidor?.id === id ? medidor : null, sesion);
  }

  async obtenerMedidorPorQr(
    codigoQr: string,
    sesion: SesionActual,
  ): Promise<Medidor> {
    const medidor = await this.medidores.findOneBy({ codigoQr });
    return this.medidorVisible(
      medidor?.codigoQr === codigoQr ? medidor : null,
      sesion,
    );
  }
}
