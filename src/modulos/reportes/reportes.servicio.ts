import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  type FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import type { Meta, ResumenDemoras } from '../../../contrato/api.js';
import type { ReporteDeDemora } from '../../../contrato/tipos.js';
import { ArchivosServicio } from '../../comun/archivos/archivos.servicio.js';
import { ExclusionPorClave } from '../../comun/db/exclusion.js';
import { esViolacionDeUnicidad } from '../../comun/db/unicidad.js';
import { ErrorDeApi } from '../../comun/errores/error-de-api.js';
import { interpretarInstante, sinMilisegundos } from '../../comun/fechas/fechas.js';
import { esIdDe, nuevoId } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { paginar } from '../../comun/respuesta/respuesta.js';
import { LineaEntidad } from '../red/linea.entidad.js';
import { ParadaEntidad } from '../red/parada.entidad.js';
import { RecorridoParadaEntidad } from '../red/recorrido-parada.entidad.js';
import { ConfirmacionDemoraEntidad } from './confirmacion-demora.entidad.js';
import type { CrearReporteDto } from './dto/crear-reporte.dto.js';
import type { ListarReportesDto } from './dto/listar-reportes.dto.js';
import type { ResumenReportesDto } from './dto/resumen-reportes.dto.js';
import { ReporteDemoraEntidad } from './reporte-demora.entidad.js';
import { reporteAContrato, resumenAContrato } from './reportes.mapeador.js';
import { resumirReportes } from './reglas/resumen.js';
import {
  chocaConOtroReporte,
  esFechaFutura,
  esReciente,
  limiteDeRecientes,
  MINUTOS_ENTRE_REPORTES,
} from './reglas/tiempos.js';

interface Pagina<T> {
  datos: T[];
  meta: Meta;
}

const MINUTO = 60_000;

@Injectable()
export class ReportesServicio {
  /**
   * R13 y el id del cliente no se pueden garantizar con un índice único (la ventana de 15
   * minutos se mueve), así que los pedidos de una misma persona sobre una misma línea y parada
   * corren de a uno dentro del proceso. La clave primaria igual frena un id repetido.
   */
  private readonly altas = new ExclusionPorClave();
  /** Las confirmaciones de un reporte recalculan su contador: de a una. */
  private readonly confirmaciones = new ExclusionPorClave();

  constructor(
    @InjectRepository(ReporteDemoraEntidad)
    private readonly reportes: Repository<ReporteDemoraEntidad>,
    @InjectRepository(ConfirmacionDemoraEntidad)
    private readonly confirmadas: Repository<ConfirmacionDemoraEntidad>,
    @InjectRepository(LineaEntidad) private readonly lineas: Repository<LineaEntidad>,
    @InjectRepository(ParadaEntidad) private readonly paradas: Repository<ParadaEntidad>,
    @InjectRepository(RecorridoParadaEntidad)
    private readonly recorridos: Repository<RecorridoParadaEntidad>,
    private readonly dataSource: DataSource,
    private readonly archivos: ArchivosServicio,
    private readonly reloj: Reloj,
  ) {}

  /** R12, R13 y AGENTS §10.5. `creado` es false si el `id` ya era de esa persona (reenvío). */
  crear(
    usuarioId: string,
    dto: CrearReporteDto,
  ): Promise<{ reporte: ReporteDeDemora; creado: boolean }> {
    return this.altas.ejecutar(`${usuarioId}|${dto.lineaId}|${dto.paradaId}`, async () => {
      const previo = await this.deEstaPersona(usuarioId, dto.id);
      if (previo) return { reporte: await this.aContrato(previo), creado: false };

      await this.exigirLineaYParada(dto.lineaId, dto.paradaId);
      const fechaHora = interpretarInstante(dto.fechaHora) as Date;
      if (esFechaFutura(fechaHora, this.reloj.ahora())) throw new ErrorDeApi('FECHA_EN_EL_FUTURO');
      const fotoClave = dto.fotoUri == null ? null : await this.claveDeFoto(dto.fotoUri);
      await this.exigirSinRepetido(usuarioId, dto, fechaHora);

      const nuevo = this.reportes.create({
        id: dto.id ?? nuevoId('rep'),
        lineaId: dto.lineaId,
        paradaId: dto.paradaId,
        usuarioId,
        motivo: dto.motivo,
        comentario: dto.comentario ? dto.comentario : null,
        fotoClave,
        confirmaciones: 0,
        fechaHora: sinMilisegundos(fechaHora),
      });
      try {
        await this.reportes.insert(nuevo);
      } catch (error) {
        if (!esViolacionDeUnicidad(error)) throw error;
        // Dos pedidos con el mismo id a la vez: gana el primero.
        const previo = await this.deEstaPersona(usuarioId, nuevo.id);
        if (!previo) throw error;
        return { reporte: await this.aContrato(previo), creado: false };
      }
      return { reporte: await this.aContrato(nuevo), creado: true };
    });
  }

  /** R14: sólo los recientes, el más nuevo primero. */
  async listar(filtros: ListarReportesDto): Promise<Pagina<ReporteDeDemora>> {
    if (!filtros.paradaId && !filtros.lineaId) {
      throw new ErrorDeApi(
        'VALIDACION_FALLIDA',
        'Hace falta indicar la parada (paradaId) o la línea (lineaId).',
      );
    }
    const where: FindOptionsWhere<ReporteDemoraEntidad> = {
      fechaHora: MoreThanOrEqual(limiteDeRecientes(this.reloj.ahora())),
    };
    if (filtros.paradaId) where.paradaId = filtros.paradaId;
    if (filtros.lineaId) where.lineaId = filtros.lineaId;

    const pagina = paginar(filtros);
    const [filas, total] = await this.reportes.findAndCount({
      where,
      order: { fechaHora: 'DESC', id: 'ASC' },
      skip: pagina.skip,
      take: pagina.take,
    });
    // MySQL y MariaDB no distinguen mayúsculas al comparar ids: se afina acá.
    const exactas = filas.filter(
      (f) =>
        (!filtros.paradaId || f.paradaId === filtros.paradaId) &&
        (!filtros.lineaId || f.lineaId === filtros.lineaId),
    );
    return {
      datos: await this.aContratoLista(exactas),
      meta: {
        total: total - (filas.length - exactas.length),
        pagina: pagina.pagina,
        porPagina: pagina.porPagina,
      },
    };
  }

  /** R14 y R15. `creada` es false si esa persona ya había confirmado. */
  confirmar(usuarioId: string, id: string): Promise<{ reporte: ReporteDeDemora; creada: boolean }> {
    return this.confirmaciones.ejecutar(id, async () => {
      const reporte = esIdDe('rep', id) ? await this.reportes.findOneBy({ id }) : null;
      if (!reporte || reporte.id !== id) throw new ErrorDeApi('REPORTE_NO_ENCONTRADO');
      if (reporte.usuarioId === usuarioId) throw new ErrorDeApi('CONFIRMACION_PROPIA');

      const yaConfirmo = await this.confirmadas.findOneBy({ reporteId: id, usuarioId });
      if (yaConfirmo) return { reporte: await this.aContrato(reporte), creada: false };
      if (!esReciente(reporte.fechaHora, this.reloj.ahora())) {
        throw new ErrorDeApi('REPORTE_VENCIDO');
      }

      await this.dataSource.transaction(async (manejador) => {
        await manejador.insert(ConfirmacionDemoraEntidad, {
          reporteId: id,
          usuarioId,
          creadaEn: sinMilisegundos(this.reloj.ahora()),
        });
        // El contador sale de la tabla, no de un +1 (AGENTS §5.5).
        const total = await manejador.countBy(ConfirmacionDemoraEntidad, { reporteId: id });
        await manejador.update(ReporteDemoraEntidad, { id }, { confirmaciones: total });
      });
      const actualizado = await this.reportes.findOneByOrFail({ id });
      return { reporte: await this.aContrato(actualizado), creada: true };
    });
  }

  /** D8: para la Dirección. Sin `desde` ni `hasta`, todos los reportes. */
  async resumen(filtros: ResumenReportesDto): Promise<Pagina<ResumenDemoras>> {
    const desde = filtros.desde ? (interpretarInstante(filtros.desde) as Date) : null;
    const hasta = filtros.hasta ? (interpretarInstante(filtros.hasta) as Date) : null;
    if (desde && hasta && hasta < desde) {
      throw new ErrorDeApi(
        'VALIDACION_FALLIDA',
        'El fin (hasta) no puede ser anterior al inicio (desde).',
      );
    }
    const where: FindOptionsWhere<ReporteDemoraEntidad> = {};
    if (desde && hasta) where.fechaHora = Between(desde, hasta);
    else if (desde) where.fechaHora = MoreThanOrEqual(desde);
    else if (hasta) where.fechaHora = LessThanOrEqual(hasta);

    const filas = await this.reportes.find({
      select: { lineaId: true, paradaId: true, confirmaciones: true, fechaHora: true },
      where,
    });
    const grupos = resumirReportes(filas, filtros.agrupar ?? 'linea');
    const pagina = paginar(filtros);
    return {
      datos: grupos.slice(pagina.skip, pagina.skip + pagina.take).map(resumenAContrato),
      meta: { total: grupos.length, pagina: pagina.pagina, porPagina: pagina.porPagina },
    };
  }

  /** El reporte con ese `id`, si es de esta persona; si es de otra, ID_EN_USO. */
  private async deEstaPersona(
    usuarioId: string,
    id: string | undefined | null,
  ): Promise<ReporteDemoraEntidad | null> {
    if (!id) return null;
    const existente = await this.reportes.findOneBy({ id });
    // MySQL y MariaDB no distinguen mayúsculas: "rep-ABC" y "rep-abc" no son el mismo id.
    if (!existente || existente.id !== id) return null;
    if (existente.usuarioId !== usuarioId) throw new ErrorDeApi('ID_EN_USO');
    return existente;
  }

  private async exigirLineaYParada(lineaId: string, paradaId: string): Promise<void> {
    const linea = esIdDe('lin', lineaId) ? await this.lineas.findOneBy({ id: lineaId }) : null;
    if (!linea || linea.id !== lineaId) throw new ErrorDeApi('LINEA_NO_ENCONTRADA');
    const parada = esIdDe('par', paradaId) ? await this.paradas.findOneBy({ id: paradaId }) : null;
    if (!parada || parada.id !== paradaId) throw new ErrorDeApi('PARADA_NO_ENCONTRADA');
    if (!(await this.recorridos.existsBy({ lineaId, paradaId }))) {
      throw new ErrorDeApi('LINEA_NO_PARA_EN_PARADA');
    }
  }

  /** R12: la foto tiene que ser una imagen de esta API. */
  private async claveDeFoto(url: string): Promise<string> {
    const clave = await this.archivos.claveSubida(url, 'imagen');
    if (!clave) throw new ErrorDeApi('ARCHIVO_NO_SUBIDO', 'Primero hay que subir la foto.');
    return clave;
  }

  /** R13 (D7). */
  private async exigirSinRepetido(
    usuarioId: string,
    dto: CrearReporteDto,
    fechaHora: Date,
  ): Promise<void> {
    const margen = MINUTOS_ENTRE_REPORTES * MINUTO;
    const cercanos = await this.reportes.find({
      where: {
        usuarioId,
        lineaId: dto.lineaId,
        paradaId: dto.paradaId,
        fechaHora: Between(
          new Date(fechaHora.getTime() - margen),
          new Date(fechaHora.getTime() + margen),
        ),
      },
    });
    if (cercanos.some((r) => chocaConOtroReporte(sinMilisegundos(fechaHora), r.fechaHora))) {
      throw new ErrorDeApi('REPORTE_YA_ENVIADO');
    }
  }

  private async aContrato(reporte: ReporteDemoraEntidad): Promise<ReporteDeDemora> {
    return (await this.aContratoLista([reporte]))[0];
  }

  private aContratoLista(reportes: ReporteDemoraEntidad[]): Promise<ReporteDeDemora[]> {
    return Promise.resolve(reportes.map((r) => reporteAContrato(r, (c) => this.archivos.urlDe(c))));
  }
}
