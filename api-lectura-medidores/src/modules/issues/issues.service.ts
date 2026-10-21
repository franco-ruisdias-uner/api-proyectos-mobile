import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type FindOptionsWhere, Repository } from 'typeorm';
import type { ResumenNovedades } from '../../../contract/api.js';
import type { Novedad } from '../../../contract/types.js';
import { ArchivosServicio } from '../../common/files/files.service.js';
import type { SesionActual } from '../../common/auth/current-session.js';
import {
  ErrorApi,
  esDeadlock,
  esViolacionDeUnicidad,
} from '../../common/errors/error-api.js';
import { leerInstante } from '../../common/dates/dates.js';
import { nuevoId } from '../../common/ids/ids.js';
import { Reloj } from '../../common/clock/clock.js';
import { paginar } from '../../common/response/pagination.js';
import type { Meta } from '../../common/response/response.js';
import { normalizarParaBusqueda } from '../../common/text/text.js';
import { LecturaEntidad } from '../readings/reading.entity.js';
import { RutaEntidad } from '../routes/route.entity.js';
import { RutaSuministroEntidad } from '../routes/route-supply.entity.js';
import { RutasServicio } from '../routes/routes.service.js';
import type {
  CargarNovedadDto,
  ListarNovedadesDeRutaDto,
  ListarNovedadesDto,
  ResumenNovedadesDto,
} from './dto/issues.dto.js';
import { NovedadEntidad } from './issue.entity.js';
import { aContrato } from './issues.mapper.js';
import { bimestreDe, resumirNovedades } from './rules/issues.js';
import { novedadesVigentes } from './current.js';

/** Tolerancia por relojes desfasados (AGENTS §10.5). */
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Los instantes se guardan al segundo: así lo que se responde es lo que quedó en la base. */
function alSegundo(instante: Date): Date {
  return new Date(Math.floor(instante.getTime() / 1000) * 1000);
}

/** "AAAA-MM-DD" → el instante en que empieza ese día en Argentina; `null` si no existe. */
function inicioDeDia(dia: string): Date | null {
  return leerInstante(`${dia}T00:00:00-03:00`);
}

@Injectable()
export class NovedadesServicio {
  constructor(
    @InjectRepository(NovedadEntidad)
    private readonly novedades: Repository<NovedadEntidad>,
    @InjectRepository(LecturaEntidad)
    private readonly lecturas: Repository<LecturaEntidad>,
    @InjectRepository(RutaEntidad)
    private readonly rutasRepo: Repository<RutaEntidad>,
    @InjectRepository(RutaSuministroEntidad)
    private readonly posiciones: Repository<RutaSuministroEntidad>,
    private readonly rutas: RutasServicio,
    private readonly dataSource: DataSource,
    private readonly reloj: Reloj,
    private readonly archivos: ArchivosServicio,
  ) {}

  private url = (clave: string) => this.archivos.url(clave);

  /** Los ids distinguen mayúsculas; MySQL y MariaDB no al comparar: se confirma acá. */
  private async buscarPorId(id: string): Promise<NovedadEntidad | null> {
    const n = await this.novedades.findOneBy({ id });
    return n?.id === id ? n : null;
  }

  /** R15: el mismo id del mismo lector es un reintento; de otro lector, `ID_EN_USO`. */
  private reintento(existente: NovedadEntidad, sesion: SesionActual): Novedad {
    if (existente.lectorId !== sesion.usuarioId)
      throw new ErrorApi('ID_EN_USO');
    return aContrato(existente, this.url);
  }

  async cargar(
    dto: CargarNovedadDto,
    sesion: SesionActual,
  ): Promise<{ novedad: Novedad; creada: boolean }> {
    if (dto.id !== undefined) {
      const existente = await this.buscarPorId(dto.id);
      if (existente)
        return { novedad: this.reintento(existente, sesion), creada: false };
    }
    // R12 (por R18), en este orden.
    const ruta = await this.rutas.buscarDelLector(dto.rutaId, sesion);
    if (ruta.estado === 'cerrada') this.rutas.errorDeRutaCerrada(ruta);
    const enRuta = await this.posiciones.findOneBy({
      rutaId: ruta.id,
      suministroId: dto.suministroId,
    });
    if (enRuta?.suministroId !== dto.suministroId)
      throw new ErrorApi('SUMINISTRO_FUERA_DE_RUTA');
    if (typeof dto.fotoUri !== 'string' || dto.fotoUri.trim() === '')
      throw new ErrorApi('FOTO_REQUERIDA');
    const fotoClave = await this.archivos.claveDeArchivoSubido(
      dto.fotoUri.trim(),
    );
    // Una foto es una imagen: un audio o un video subidos no valen.
    if (!fotoClave.startsWith('imagenes/'))
      throw new ErrorApi('FOTO_REQUERIDA');
    const audioUri = dto.audioUri?.trim() ?? '';
    let audioClave: string | null = null;
    if (audioUri !== '') {
      audioClave = await this.archivos.claveDeArchivoSubido(audioUri);
      if (!audioClave.startsWith('audios/'))
        throw new ErrorApi(
          'VALIDACION_FALLIDA',
          'La nota de voz tiene que ser un audio.',
        );
    }
    const fechaHora = leerInstante(dto.fechaHora);
    if (fechaHora === null)
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'La fecha y hora de la novedad no es válida.',
      );
    if (
      fechaHora.getTime() >
      this.reloj.ahora().getTime() + TOLERANCIA_FUTURO_MS
    )
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'La fecha y hora de la novedad todavía no llegó.',
      );

    const comentario = dto.comentario?.trim() ?? '';
    const id = dto.id ?? nuevoId('nov');
    const fila: NovedadEntidad = {
      id,
      rutaId: ruta.id,
      suministroId: dto.suministroId,
      lectorId: sesion.usuarioId,
      motivo: dto.motivo,
      comentario: comentario === '' ? null : comentario,
      audioClave,
      fotoClave,
      fechaHora: alSegundo(fechaHora),
      recibidaEn: alSegundo(this.reloj.ahora()),
    };
    try {
      await this.guardar(fila);
    } catch (error) {
      if (!esViolacionDeUnicidad(error) && !esDeadlock(error)) throw error;
      // Dos pedidos iguales a la vez: la clave primaria decidió. El que perdió es un reintento.
      const existente = await this.buscarPorId(id);
      if (!existente) throw error;
      return { novedad: this.reintento(existente, sesion), creada: false };
    }
    return { novedad: aContrato(fila, this.url), creada: true };
  }

  private async guardar(fila: NovedadEntidad): Promise<void> {
    for (let intento = 1; ; intento++) {
      try {
        await this.dataSource.transaction(async (m) => {
          await m.getRepository(NovedadEntidad).insert(fila);
          // Con el lector en la calle, la ruta deja de estar sólo asignada.
          await m
            .getRepository(RutaEntidad)
            .update(
              { id: fila.rutaId, estado: 'asignada' },
              { estado: 'en_curso' },
            );
        });
        return;
      } catch (error) {
        if (!esDeadlock(error) || intento >= 4) throw error;
        if ((await this.buscarPorId(fila.id)) !== null) throw error;
      }
    }
  }

  async obtener(id: string, sesion: SesionActual): Promise<Novedad> {
    const novedad = await this.buscarPorId(id);
    if (!novedad) throw new ErrorApi('NOVEDAD_NO_ENCONTRADA');
    await this.rutas.buscarAccesible(novedad.rutaId, sesion);
    return aContrato(novedad, this.url);
  }

  /** R13: las vigentes de la ruta, en el orden del recorrido (R4). */
  async listarDeRuta(
    rutaId: string,
    sesion: SesionActual,
    filtros: ListarNovedadesDeRutaDto,
  ): Promise<{ datos: Novedad[]; meta: Meta }> {
    await this.rutas.buscarAccesible(rutaId, sesion);
    const vigentes = await novedadesVigentes(this.novedades, this.lecturas, [
      rutaId,
    ]);
    const posiciones = await this.posiciones.find({
      where: { rutaId },
      order: { posicion: 'ASC' },
    });
    const ordenadas = posiciones
      .flatMap((p) => {
        const n = vigentes.get(`${rutaId}|${p.suministroId}`);
        return n ? [n] : [];
      })
      .filter(
        (n) => filtros.motivo === undefined || n.motivo === filtros.motivo,
      );
    const pagina = paginar(ordenadas, filtros);
    return {
      datos: pagina.datos.map((n) => aContrato(n, this.url)),
      meta: pagina.meta,
    };
  }

  /** Las rutas que cumplen el bimestre y la zona, con su nombre (la zona, D10). */
  private async rutasDe(
    bimestre?: string,
    zona?: string,
  ): Promise<Map<string, RutaEntidad>> {
    const where: FindOptionsWhere<RutaEntidad> = {};
    if (bimestre !== undefined) where.bimestre = bimestre;
    const buscada = zona === undefined ? null : normalizarParaBusqueda(zona);
    const rutas = (await this.rutasRepo.find({ where })).filter(
      (r) =>
        (bimestre === undefined || r.bimestre === bimestre) &&
        (buscada === null || normalizarParaBusqueda(r.nombre) === buscada),
    );
    return new Map(rutas.map((r) => [r.id, r]));
  }

  /** `GET /novedades`: las vigentes, de la más nueva a la más vieja. */
  async listar(
    filtros: ListarNovedadesDto,
  ): Promise<{ datos: Novedad[]; meta: Meta }> {
    let desde: Date | null = null;
    let hasta: Date | null = null;
    if (filtros.desde !== undefined) {
      desde = inicioDeDia(filtros.desde);
      if (desde === null)
        throw new ErrorApi(
          'VALIDACION_FALLIDA',
          'La fecha "desde" no es un día válido.',
        );
    }
    if (filtros.hasta !== undefined) {
      const dia = inicioDeDia(filtros.hasta);
      if (dia === null)
        throw new ErrorApi(
          'VALIDACION_FALLIDA',
          'La fecha "hasta" no es un día válido.',
        );
      hasta = new Date(dia.getTime() + UN_DIA_MS);
    }
    const rutas = await this.rutasDe(filtros.bimestre, filtros.zona);
    const vigentes = await novedadesVigentes(this.novedades, this.lecturas, [
      ...rutas.keys(),
    ]);
    const filtradas = [...vigentes.values()]
      .filter(
        (n) =>
          (filtros.motivo === undefined || n.motivo === filtros.motivo) &&
          (desde === null || n.fechaHora >= desde) &&
          (hasta === null || n.fechaHora < hasta),
      )
      .sort(
        (a, b) =>
          b.fechaHora.getTime() - a.fechaHora.getTime() ||
          (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
      );
    const pagina = paginar(filtradas, filtros);
    return {
      datos: pagina.datos.map((n) => aContrato(n, this.url)),
      meta: pagina.meta,
    };
  }

  /** R19: las novedades vigentes del bimestre, por motivo y zona. */
  async resumen(
    filtros: ResumenNovedadesDto,
  ): Promise<{ datos: ResumenNovedades[]; meta: Meta }> {
    const bimestre = filtros.bimestre ?? bimestreDe(this.reloj.ahora());
    const rutas = await this.rutasDe(bimestre);
    const vigentes = await novedadesVigentes(this.novedades, this.lecturas, [
      ...rutas.keys(),
    ]);
    const grupos = resumirNovedades(
      [...vigentes.values()].map((n) => ({
        motivo: n.motivo,
        zona: rutas.get(n.rutaId)?.nombre ?? '',
      })),
    );
    return paginar(grupos, filtros);
  }
}
