import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, type FindOptionsWhere, In, Like, MoreThan, Repository } from 'typeorm';
import type { Meta } from '../../../contract/api.js';
import type { Lugar } from '../../../contract/types.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { leerInstante } from '../../common/dates/dates.js';
import { cajaAlrededor, cruzaElAntimeridianoOUnPolo } from '../../common/geo/geo.js';
import { esIdConPrefijo, nuevoId } from '../../common/ids/ids.js';
import { Reloj } from '../../common/clock/clock.js';
import { calcularPaginacion } from '../../common/response/pagination.js';
import { normalizarBusqueda } from '../../common/text/text.js';
import { CategoriasServicio } from '../categories/categories.service.js';
import type { ListarLugaresDto } from './dto/list-places.dto.js';
import type { LugarACargar } from './place-to-load.js';
import { LugarEntidad } from './place.entity.js';
import { aContrato } from './places.mapper.js';
import { inicioDeTemporada } from './rules/hours.js';
import {
  coincideBusqueda,
  ordenarLugares,
  patronLike,
  problemaDeFiltros,
  terminoDeBusqueda,
} from './rules/listing.js';
import { codigoQrDe, leerCodigoQr } from './rules/qr.js';

@Injectable()
export class LugaresServicio {
  constructor(
    @InjectRepository(LugarEntidad) private readonly repo: Repository<LugarEntidad>,
    private readonly categorias: CategoriasServicio,
    private readonly reloj: Reloj,
  ) {}

  async listar(filtros: ListarLugaresDto): Promise<{ datos: Lugar[]; meta: Meta }> {
    const problema = problemaDeFiltros(filtros);
    if (problema) throw new ErrorApi('VALIDACION_FALLIDA', problema);
    const ahora = this.reloj.ahora();
    const { pagina, porPagina, saltar } = calcularPaginacion(filtros);
    // Una categoría con un id que no puede existir da la lista vacía, sin ir a la base (que
    // además, en PostgreSQL, rechaza un byte nulo en un texto).
    if (filtros.categoriaId !== undefined && !esIdConPrefijo(filtros.categoriaId, 'cat')) {
      return { datos: [], meta: { total: 0, pagina, porPagina } };
    }
    const punto =
      filtros.latitud !== undefined && filtros.longitud !== undefined
        ? { latitud: filtros.latitud, longitud: filtros.longitud }
        : undefined;
    const termino = terminoDeBusqueda(filtros.q ?? '');

    // 1. La base filtra lo grueso y trae sólo lo necesario para ordenar.
    const base: FindOptionsWhere<LugarEntidad> = {};
    if (filtros.categoriaId !== undefined) base.categoriaId = filtros.categoriaId;
    if (filtros.accesible) base.accesible = true;
    if (termino) base.nombreBusqueda = Like(patronLike(termino));
    if (punto && filtros.radioMetros !== undefined) {
      const caja = cajaAlrededor(punto, filtros.radioMetros);
      base.latitud = Between(caja.latitudMin, caja.latitudMax);
      if (!cruzaElAntimeridianoOUnPolo(caja)) base.longitud = Between(caja.longitudMin, caja.longitudMax);
    }
    const where = this.condicionesDeVigencia(base, filtros.actualizadoDesde, ahora);
    const filas = await this.repo.find({
      where,
      select: { id: true, nombreBusqueda: true, categoriaId: true, latitud: true, longitud: true },
    });

    // 2. Lo exacto, el radio y el orden, en TypeScript: igual en los cuatro motores (MySQL y
    //    MariaDB comparan texto sin distinguir mayúsculas; cada motor ordena texto a su manera).
    const exactas = filas.filter(
      (f) =>
        (filtros.categoriaId === undefined || f.categoriaId === filtros.categoriaId) &&
        coincideBusqueda(f.nombreBusqueda, termino),
    );
    const ordenadas = ordenarLugares(exactas, {
      orden: filtros.orden ?? 'nombre',
      punto,
      radioMetros: filtros.radioMetros,
    });

    // 3. La página, completa.
    const idsPagina = ordenadas.slice(saltar, saltar + porPagina).map((f) => f.id);
    const entidades = idsPagina.length > 0 ? await this.repo.findBy({ id: In(idsPagina) }) : [];
    const porId = new Map(entidades.map((e) => [e.id, e]));
    const datos = idsPagina.flatMap((id) => {
      const entidad = porId.get(id);
      return entidad ? [aContrato(entidad, ahora)] : [];
    });
    return { datos, meta: { total: ordenadas.length, pagina, porPagina } };
  }

  /** Detalle: también los dados de baja (D6). */
  async detalle(id: string): Promise<Lugar> {
    const lugar = await this.buscar(id);
    if (!lugar) throw new ErrorApi('LUGAR_NO_ENCONTRADO');
    return aContrato(lugar, this.reloj.ahora());
  }

  async existe(id: string): Promise<boolean> {
    return (await this.buscar(id)) !== null;
  }

  /** R6: cualquier cosa que no sea el QR de un lugar nuestro es `QR_NO_RECONOCIDO`. */
  async porQr(codigo: string): Promise<Lugar> {
    const id = leerCodigoQr(codigo);
    const lugar = id ? await this.buscar(id) : null;
    if (!id || !lugar || lugar.codigoQr !== codigoQrDe(id)) throw new ErrorApi('QR_NO_RECONOCIDO');
    return aContrato(lugar, this.reloj.ahora());
  }

  /**
   * Alta desde la semilla (no hay endpoint: los lugares los carga la cátedra, especificación
   * §9). Mantiene las columnas internas: nombre normalizado, temporadas y código QR.
   */
  async cargar(datos: LugarACargar): Promise<string> {
    const id = datos.id ?? nuevoId('lug');
    if (!esIdConPrefijo(id, 'lug')) throw new Error(`Id de lugar inválido: ${id}`);
    if (!(await this.categorias.existe(datos.categoriaId))) {
      throw new Error(`La categoría ${datos.categoriaId} no existe`);
    }
    await this.repo.insert({
      id,
      nombre: datos.nombre,
      nombreBusqueda: normalizarBusqueda(datos.nombre),
      categoriaId: datos.categoriaId,
      descripcionCorta: datos.descripcionCorta,
      descripcion: datos.descripcion,
      latitud: datos.coordenadas.latitud,
      longitud: datos.coordenadas.longitud,
      direccion: datos.direccion,
      imagenes: [...datos.imagenes],
      horarios: datos.horarios.map((h) => ({ ...h })),
      tieneTemporadas: datos.horarios.some((h) => h.temporada !== 'todo-el-anio'),
      telefono: datos.telefono,
      sitioWeb: datos.sitioWeb,
      precioEntrada: datos.precioEntrada,
      audioguiaClave: datos.audioguia?.clave ?? null,
      audioguiaDuracionSegundos: datos.audioguia?.duracionSegundos ?? null,
      audioguiaIdioma: datos.audioguia?.idioma ?? null,
      codigoQr: datos.conQr ? codigoQrDe(id) : null,
      accesible: datos.accesible,
      activo: datos.activo,
      actualizadoEn: datos.actualizadoEn ?? this.reloj.ahora(),
    });
    return id;
  }

  /**
   * Sin `actualizadoDesde`, sólo los activos. Con él, los cambiados después, activos o no (D6),
   * más los que tienen horario de temporada si la temporada empezó después (D1): sus horarios
   * vigentes cambiaron aunque nadie los haya editado.
   */
  private condicionesDeVigencia(
    base: FindOptionsWhere<LugarEntidad>,
    actualizadoDesde: string | undefined,
    ahora: Date,
  ): FindOptionsWhere<LugarEntidad>[] {
    const desde = actualizadoDesde === undefined ? null : leerInstante(actualizadoDesde);
    if (!desde) return [{ ...base, activo: true }];
    const condiciones: FindOptionsWhere<LugarEntidad>[] = [{ ...base, actualizadoEn: MoreThan(desde) }];
    if (inicioDeTemporada(ahora).getTime() > desde.getTime()) {
      condiciones.push({ ...base, tieneTemporadas: true });
    }
    return condiciones;
  }

  /** Por id exacto: en MySQL y MariaDB `lug-ABC` encontraría `lug-abc`. */
  private async buscar(id: string): Promise<LugarEntidad | null> {
    if (!esIdConPrefijo(id, 'lug')) return null;
    const lugar = await this.repo.findOneBy({ id });
    return lugar?.id === id ? lugar : null;
  }
}
