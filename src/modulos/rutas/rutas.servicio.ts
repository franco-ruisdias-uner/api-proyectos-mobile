import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  type EntityManager,
  type FindOptionsOrder,
  type FindOptionsWhere,
  In,
  IsNull,
  Repository,
} from 'typeorm';
import type { AvanceRuta, PaqueteRuta } from '../../../contrato/api.js';
import type { EstadoRuta, Ruta, Suministro } from '../../../contrato/tipos.js';
import { ArchivosServicio } from '../../comun/archivos/archivos.servicio.js';
import type { SesionActual } from '../../comun/auth/sesion-actual.js';
import {
  ErrorApi,
  esViolacionDeUnicidad,
} from '../../comun/errores/error-api.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { paginar } from '../../comun/respuesta/paginacion.js';
import type { Meta } from '../../comun/respuesta/respuesta.js';
import { MedidorEntidad } from '../suministros/medidor.entidad.js';
import { SuministroEntidad } from '../suministros/suministro.entidad.js';
import {
  aContrato as suministroAContrato,
  medidorAContrato,
} from '../suministros/suministros.mapeador.js';
import { UsuarioEntidad } from '../usuarios/usuario.entidad.js';
import type {
  ActualizarRutaDto,
  CrearRutaDto,
  ListarRutasDto,
  MisRutasDto,
} from './dto/rutas.dto.js';
import {
  calcularAvance,
  idDeRuta,
  mensajeRutaCerrada,
  primerRepetido,
} from './reglas/rutas.js';
import { RutaSuministroEntidad } from './ruta-suministro.entidad.js';
import { RutaEntidad } from './ruta.entidad.js';
import { aContrato } from './rutas.mapeador.js';

const ESTADOS_ABIERTOS: EstadoRuta[] = ['asignada', 'en_curso'];
const TANDA = 100;

function enTandas<T>(filas: T[], tamano = TANDA): T[][] {
  const tandas: T[][] = [];
  for (let i = 0; i < filas.length; i += tamano)
    tandas.push(filas.slice(i, i + tamano));
  return tandas;
}

/** Los instantes se guardan al segundo: así lo que se responde es lo que quedó en la base. */
function alSegundo(instante: Date): Date {
  return new Date(Math.floor(instante.getTime() / 1000) * 1000);
}

@Injectable()
export class RutasServicio {
  constructor(
    @InjectRepository(RutaEntidad)
    private readonly rutas: Repository<RutaEntidad>,
    @InjectRepository(RutaSuministroEntidad)
    private readonly posiciones: Repository<RutaSuministroEntidad>,
    @InjectRepository(SuministroEntidad)
    private readonly suministros: Repository<SuministroEntidad>,
    @InjectRepository(MedidorEntidad)
    private readonly medidores: Repository<MedidorEntidad>,
    @InjectRepository(UsuarioEntidad)
    private readonly usuarios: Repository<UsuarioEntidad>,
    private readonly dataSource: DataSource,
    private readonly reloj: Reloj,
    private readonly archivos: ArchivosServicio,
  ) {}

  // ---- lectura ----

  /** Los ids de suministro de cada ruta, en el orden del recorrido (R4: sólo por `posicion`). */
  private async suministroIdsDe(
    rutaIds: string[],
  ): Promise<Map<string, string[]>> {
    const porRuta = new Map<string, string[]>(rutaIds.map((id) => [id, []]));
    for (const tanda of enTandas(rutaIds)) {
      const filas = await this.posiciones.find({
        where: { rutaId: In(tanda) },
        order: { posicion: 'ASC' },
      });
      for (const f of filas) porRuta.get(f.rutaId)?.push(f.suministroId);
    }
    return porRuta;
  }

  private async aContratos(rutas: RutaEntidad[]): Promise<Ruta[]> {
    const ids = await this.suministroIdsDe(rutas.map((r) => r.id));
    return rutas.map((r) => aContrato(r, ids.get(r.id) ?? []));
  }

  /** Los ids distinguen mayúsculas; MySQL y MariaDB no al comparar: se confirma acá. */
  private async buscar(id: string): Promise<RutaEntidad> {
    const ruta = await this.rutas.findOneBy({ id });
    if (ruta?.id !== id) throw new ErrorApi('RUTA_NO_ENCONTRADA');
    return ruta;
  }

  /** R3: el lector dueño de la ruta o administración. Lo usan también lecturas, novedades y cierre. */
  async buscarAccesible(
    id: string,
    sesion: SesionActual,
  ): Promise<RutaEntidad> {
    const ruta = await this.buscar(id);
    if (sesion.rol !== 'administracion' && ruta.lectorId !== sesion.usuarioId)
      throw new ErrorApi('SIN_PERMISO');
    return ruta;
  }

  async obtener(id: string, sesion: SesionActual): Promise<Ruta> {
    const ruta = await this.buscarAccesible(id, sesion);
    return (await this.aContratos([ruta]))[0];
  }

  private async listarDonde(
    where: FindOptionsWhere<RutaEntidad>,
    filtro: (r: RutaEntidad) => boolean,
    paginacion: { pagina: number; porPagina: number },
    orden: FindOptionsOrder<RutaEntidad>,
  ): Promise<{ datos: Ruta[]; meta: Meta }> {
    // Pocas rutas por bimestre: se filtra lo que MySQL compararía sin distinguir mayúsculas
    // y se pagina acá, así el resultado es idéntico en los cuatro motores.
    const encontradas = (await this.rutas.find({ where, order: orden })).filter(
      filtro,
    );
    const pagina = paginar(encontradas, paginacion);
    return { datos: await this.aContratos(pagina.datos), meta: pagina.meta };
  }

  /** `GET /yo/rutas`: las del lector de la sesión, por número. */
  async listarMias(
    sesion: SesionActual,
    filtros: MisRutasDto,
  ): Promise<{ datos: Ruta[]; meta: Meta }> {
    const estados = filtros.estado ?? ESTADOS_ABIERTOS;
    return this.listarDonde(
      { lectorId: sesion.usuarioId, estado: In(estados) },
      (r) => r.lectorId === sesion.usuarioId,
      filtros,
      { numero: 'ASC', bimestre: 'DESC', id: 'ASC' },
    );
  }

  async listar(
    filtros: ListarRutasDto,
  ): Promise<{ datos: Ruta[]; meta: Meta }> {
    const where: FindOptionsWhere<RutaEntidad> = {};
    if (filtros.bimestre !== undefined) where.bimestre = filtros.bimestre;
    if (filtros.lectorId !== undefined) where.lectorId = filtros.lectorId;
    if (filtros.estado !== undefined) where.estado = In(filtros.estado);
    return this.listarDonde(
      where,
      (r) => filtros.lectorId === undefined || r.lectorId === filtros.lectorId,
      filtros,
      { bimestre: 'DESC', numero: 'ASC', id: 'ASC' },
    );
  }

  async listarSuministros(
    id: string,
    sesion: SesionActual,
    { pagina, porPagina }: { pagina: number; porPagina: number },
  ): Promise<{ datos: Suministro[]; meta: Meta }> {
    await this.buscarAccesible(id, sesion);
    const [filas, total] = await this.posiciones.findAndCount({
      where: { rutaId: id },
      order: { posicion: 'ASC' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    });
    const porId = await this.suministrosPorId(filas.map((f) => f.suministroId));
    return {
      datos: filas.flatMap((f) => {
        const s = porId.get(f.suministroId);
        return s ? [suministroAContrato(s)] : [];
      }),
      meta: { total, pagina, porPagina },
    };
  }

  private async suministrosPorId(
    ids: string[],
  ): Promise<Map<string, SuministroEntidad>> {
    const mapa = new Map<string, SuministroEntidad>();
    for (const tanda of enTandas(ids)) {
      for (const s of await this.suministros.findBy({ id: In(tanda) }))
        mapa.set(s.id, s);
    }
    return mapa;
  }

  // ---- descarga y avance ----

  /** R7: todo lo que el teléfono necesita para la jornada, sin paginar. */
  async descargar(id: string, sesion: SesionActual): Promise<PaqueteRuta> {
    let ruta = await this.buscarAccesible(id, sesion);
    if (ruta.estado === 'cerrada') this.errorCerrada(ruta);
    if (ruta.descargadaEn === null) {
      // Sólo la primera descarga; si dos llegan juntas, la segunda no pisa a la primera.
      await this.rutas.update(
        { id, descargadaEn: IsNull(), estado: In(ESTADOS_ABIERTOS) },
        { descargadaEn: alSegundo(this.reloj.ahora()), estado: 'en_curso' },
      );
      ruta = await this.buscar(id);
      if (ruta.estado === 'cerrada') this.errorCerrada(ruta);
    }
    const [contrato] = await this.aContratos([ruta]);
    const porId = await this.suministrosPorId(contrato.suministroIds);
    const entidades = contrato.suministroIds.flatMap((sid) => {
      const s = porId.get(sid);
      return s ? [s] : [];
    });
    const medidores = new Map<string, MedidorEntidad>();
    for (const tanda of enTandas(entidades.map((s) => s.medidorId))) {
      for (const m of await this.medidores.findBy({ id: In(tanda) }))
        medidores.set(m.id, m);
    }
    return {
      ruta: contrato,
      suministros: entidades.map(suministroAContrato),
      medidores: entidades.flatMap((s) => {
        const m = medidores.get(s.medidorId);
        return m ? [medidorAContrato(m, (c) => this.archivos.url(c))] : [];
      }),
      // Las lecturas y novedades vigentes se suman en M3 y M4.
      lecturas: [],
      novedades: [],
    };
  }

  async avance(id: string, sesion: SesionActual): Promise<AvanceRuta> {
    await this.buscarAccesible(id, sesion);
    const suministros = await this.posiciones.countBy({ rutaId: id });
    // Los resultados vigentes (R13) llegan con M3 y M4: hasta entonces no hay ninguno.
    return calcularAvance(id, {
      suministros,
      leidos: 0,
      conNovedad: 0,
      fueraDeRango: 0,
    });
  }

  private errorCerrada(ruta: RutaEntidad): never {
    throw new ErrorApi(
      'RUTA_YA_CERRADA',
      ruta.cerradaEn ? mensajeRutaCerrada(ruta.cerradaEn) : undefined,
    );
  }

  // ---- armado y asignación (administración) ----

  private async exigirLector(lectorId: string): Promise<void> {
    const lector = await this.usuarios.findOneBy({ id: lectorId });
    if (lector?.id !== lectorId || lector.rol !== 'lector')
      throw new ErrorApi('LECTOR_NO_ENCONTRADO');
  }

  /** R5: sin repetidos, todos existentes y ninguno en otra ruta del bimestre. */
  private async exigirSuministros(
    suministroIds: string[],
    bimestre: string,
    propia?: string,
  ): Promise<void> {
    if (primerRepetido(suministroIds) !== undefined)
      throw new ErrorApi('SUMINISTRO_REPETIDO');
    const existentes = await this.suministrosPorId(suministroIds);
    if (suministroIds.some((sid) => !existentes.has(sid)))
      throw new ErrorApi('SUMINISTRO_NO_ENCONTRADO');
    const ocupados = new Map<string, string>();
    for (const tanda of enTandas(suministroIds)) {
      for (const p of await this.posiciones.findBy({
        bimestre,
        suministroId: In(tanda),
      })) {
        if (p.rutaId !== propia) ocupados.set(p.suministroId, p.rutaId);
      }
    }
    const choque = suministroIds.find((sid) => ocupados.has(sid));
    if (choque !== undefined) {
      const otra = await this.rutas.findOneBy({ id: ocupados.get(choque) });
      throw new ErrorApi(
        'SUMINISTRO_EN_OTRA_RUTA',
        `El suministro ${existentes.get(choque)?.numero ?? ''} ya está en la ruta ${otra?.numero ?? ''} de este bimestre.`,
      );
    }
  }

  private async guardarPosiciones(
    m: EntityManager,
    rutaId: string,
    bimestre: string,
    suministroIds: string[],
  ): Promise<void> {
    const filas = suministroIds.map((suministroId, posicion) => ({
      rutaId,
      suministroId,
      bimestre,
      posicion,
    }));
    for (const tanda of enTandas(filas))
      await m.getRepository(RutaSuministroEntidad).insert(tanda);
  }

  async crear(dto: CrearRutaDto): Promise<Ruta> {
    const id = idDeRuta(dto.numero, dto.bimestre);
    await this.exigirLector(dto.lectorId);
    if (primerRepetido(dto.suministroIds) !== undefined)
      throw new ErrorApi('SUMINISTRO_REPETIDO');
    await this.exigirDisponible(dto, id);
    try {
      await this.dataSource.transaction(async (m) => {
        await m.getRepository(RutaEntidad).insert({
          id,
          numero: dto.numero,
          nombre: dto.nombre,
          bimestre: dto.bimestre,
          lectorId: dto.lectorId,
          estado: 'asignada',
          descargadaEn: null,
          cerradaEn: null,
        });
        await this.guardarPosiciones(m, id, dto.bimestre, dto.suministroIds);
      });
    } catch (error) {
      if (!esViolacionDeUnicidad(error)) throw error;
      // Dos pedidos simultáneos pasaron los controles: el índice único decidió. Se vuelve a
      // mirar para dar el código que corresponde.
      await this.exigirDisponible(dto, id);
      throw new ErrorApi('RUTA_YA_EXISTE');
    }
    return (await this.aContratos([await this.buscar(id)]))[0];
  }

  private async exigirDisponible(dto: CrearRutaDto, id: string): Promise<void> {
    if ((await this.rutas.findOneBy({ id }))?.id === id)
      throw new ErrorApi('RUTA_YA_EXISTE');
    await this.exigirSuministros(dto.suministroIds, dto.bimestre);
  }

  async actualizar(id: string, dto: ActualizarRutaDto): Promise<Ruta> {
    const ruta = await this.buscar(id);
    if (ruta.estado === 'cerrada') this.errorCerrada(ruta);
    const actuales = (await this.suministroIdsDe([id])).get(id) ?? [];
    const cambiaLista =
      dto.suministroIds !== undefined &&
      !(
        dto.suministroIds.length === actuales.length &&
        dto.suministroIds.every((sid, i) => sid === actuales[i])
      );
    if (cambiaLista && ruta.estado !== 'asignada')
      throw new ErrorApi('RUTA_EN_CURSO');
    if (dto.lectorId !== undefined) await this.exigirLector(dto.lectorId);
    if (cambiaLista && dto.suministroIds)
      await this.exigirSuministros(dto.suministroIds, ruta.bimestre, id);

    const cambios: Partial<RutaEntidad> = {};
    if (dto.nombre !== undefined) cambios.nombre = dto.nombre;
    if (dto.lectorId !== undefined) cambios.lectorId = dto.lectorId;
    try {
      await this.dataSource.transaction(async (m) => {
        if (Object.keys(cambios).length > 0)
          await m.getRepository(RutaEntidad).update({ id }, cambios);
        if (cambiaLista && dto.suministroIds) {
          await m.getRepository(RutaSuministroEntidad).delete({ rutaId: id });
          await this.guardarPosiciones(m, id, ruta.bimestre, dto.suministroIds);
        }
      });
    } catch (error) {
      if (!esViolacionDeUnicidad(error)) throw error;
      if (dto.suministroIds)
        await this.exigirSuministros(dto.suministroIds, ruta.bimestre, id);
      throw error;
    }
    return (await this.aContratos([await this.buscar(id)]))[0];
  }
}
